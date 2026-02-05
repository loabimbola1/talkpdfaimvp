import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessRequest {
  documentId: string;
  language?: string;
}

interface TTSMetadata {
  tts_provider: string;
  requested_language: string;
  translation_applied: boolean;
  failed_providers: string[];
  tts_text_length: number;
  tts_text_preview: string;
  audio_size_bytes: number;
  chunks_generated: number;
  processed_at: string;
  voice_used: string;
  file_type: string;
}

// Global declarations for Deno edge runtime
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const languageLabelMap: Record<string, string> = {
  en: "English",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
  pcm: "Nigerian Pidgin",
};

// Rate limit config: 5 PDF processes per minute per user
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,
  maxRequests: 5,
};

// YarnGPT voice mapping for Nigerian languages (Primary TTS provider)
// Reference: https://yarngpt.ai/api/v1/tts
// Available voices: Idera, Emma, Zainab, Osagie, Wura, Jude, Chinenye, Tayo, Regina, Femi, Adaora, Umar, Mary, Nonso, Remi, Adam
const yarngptVoiceMap: Record<string, string> = {
  "yo": "Adaora",    // Warm, Engaging - good for Yoruba
  "ha": "Umar",      // Calm, smooth - good for Hausa
  "ig": "Chinenye",  // Engaging, warm - good for Igbo
  "en": "Femi",      // Rich, reassuring - Nigerian English
  "pcm": "Tayo",     // Upbeat, energetic - good for Pidgin
};

// Gemini TTS voice mapping (Secondary fallback for Nigerian languages)
// Reference: https://ai.google.dev/gemini-api/docs/speech-generation
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",   // Informative - good for educational content
  "yo": "Kore",     // Firm - clear pronunciation for Nigerian languages
  "ha": "Kore",     // Firm - clear pronunciation
  "ig": "Kore",     // Firm - clear pronunciation
  "pcm": "Puck",    // Upbeat - good for Pidgin
};

// ElevenLabs voice mapping - ONLY for English on Free plan
// Using Daniel for authentic Nigerian accent English
const elevenLabsVoiceMap: Record<string, string> = {
  "en": "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent English
};

// Plan-based TTS character limits
const PLAN_TTS_LIMITS: Record<string, number> = {
  "free": 1400,    // Short summary only
  "plus": 5000,    // Extended summary (~10 min audio)
  "pro": 15000,    // Comprehensive (~25 min audio)
};

// TTS chunk limits
const SPITCH_CHUNK_LIMIT = 2000;

// Background processing function
async function processDocumentInBackground(
  documentId: string,
  userId: string,
  language: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  lovableApiKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  try {
    console.log("Background processing started for document:", documentId);
    
    // Get document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (docError || !document) {
      console.error("Document access error:", docError?.message || "Not found");
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    // Detect file type
    const fileName = document.file_name.toLowerCase();
    const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
    const fileType = isWordDoc ? "word" : "pdf";
    
    console.log(`Background: File type detected: ${fileType}`);

    // Get user's subscription plan
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("user_id", userId)
      .single();
    
    const userPlan = userProfile?.subscription_plan || "free";
    const maxTtsChars = PLAN_TTS_LIMITS[userPlan] || PLAN_TTS_LIMITS["free"];
    const maxChunks = userPlan === "pro" ? 8 : (userPlan === "plus" ? 3 : 1);
    
    console.log(`Background: User plan: ${userPlan}, Max TTS chars: ${maxTtsChars}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("talkpdf")
      .download(document.file_url);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError);
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    // Extract text from file using AI
    const fileBase64 = await blobToBase64(fileData);
    
    console.log(`Background: Extracting text from ${fileType}...`);
    
    let extractResponse: Response;
    
    if (isWordDoc) {
      extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a document extraction assistant. Your task is to EXTRACT (not generate) ALL text content from the provided document EXACTLY as it appears. CRITICAL RULES: 1. ONLY extract text that EXISTS in the document - DO NOT invent or hallucinate content. 2. DO NOT add explanations, commentary, or additional information. 3. DO NOT rephrase or paraphrase - preserve the original wording. 4. If you cannot read certain parts, indicate with [UNREADABLE] rather than guessing. 5. Preserve the document's original structure and order. Output ONLY the extracted text from the document, nothing else.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extract all text content from this Word document (${document.file_name}).` },
                { type: "file", file: { filename: document.file_name.replace(/\.docx?$/i, '.pdf'), file_data: `data:application/pdf;base64,${fileBase64}` } }
              ]
            }
          ],
          max_tokens: 16000
        })
      });
      
      if (!extractResponse.ok) {
        console.log("PDF approach failed for Word doc, trying text-based extraction...");
        extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `You are a document extraction assistant. EXTRACT ONLY the actual text content from this Word document. CRITICAL RULES: 1. ONLY extract text that EXISTS in the document - DO NOT invent content. 2. DO NOT add explanations or commentary. 3. Preserve original wording exactly as written. 4. Output ONLY the extracted text, nothing else.` },
              { role: "user", content: `I've uploaded a Word document named "${document.file_name}". Please extract the text content. Base64: ${fileBase64.substring(0, 100000)}` }
            ],
            max_tokens: 16000
          })
        });
      }
    } else {
      extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a document extraction assistant. Your task is to EXTRACT (not generate) ALL text content from the provided PDF document EXACTLY as it appears. CRITICAL RULES: 1. ONLY extract text that EXISTS in the document - DO NOT invent or hallucinate content. 2. DO NOT add explanations, commentary, or additional information. 3. DO NOT rephrase or paraphrase - preserve the original wording. 4. If you cannot read certain parts, indicate with [UNREADABLE] rather than guessing. 5. Preserve the document's original structure and order. Output ONLY the extracted text from the document, nothing else.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Extract all text content from this PDF document.` },
                { type: "file", file: { filename: document.file_name, file_data: `data:application/pdf;base64,${fileBase64}` } }
              ]
            }
          ],
          max_tokens: 16000
        })
      });
    }

    if (!extractResponse.ok) {
      console.error("AI extraction failed");
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.choices?.[0]?.message?.content || "";

    console.log("Background: Extracted text length:", extractedText.length);

    if (!extractedText || extractedText.length < 50) {
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    // Generate summary - use smaller context to save memory
    const analysisTextLimit = userPlan === "pro" ? 10000 : (userPlan === "plus" ? 6000 : 4000);
    const maxPages = userPlan === "pro" ? 30 : (userPlan === "plus" ? 20 : 0);
    let pageContents: Array<{ page: number; text: string; chapter?: string }> = [];
    let pageCount = 0;
    
    // Extract page content for Plus/Pro (simplified)
    if (maxPages > 0) {
      console.log(`Background: Extracting pages for ${userPlan} user...`);
      const pageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `Extract text by page. DO NOT invent content. Output JSON: [{"page": 1, "text": "..."}]. Max ${maxPages} pages.` },
            { role: "user", content: extractedText.substring(0, analysisTextLimit) }
          ],
          max_tokens: 4000,
          temperature: 0.3
        })
      });
      
      if (pageResponse.ok) {
        const pageData = await pageResponse.json();
        const pageContent = pageData.choices?.[0]?.message?.content || "";
        try {
          const jsonMatch = pageContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              pageContents = parsed.slice(0, maxPages);
              pageCount = pageContents.length;
            }
          }
        } catch (e) { console.warn("Page parse error:", e); }
      }
    }
    
    // Generate summary
    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Create a summary for "${userPlan}" plan. DO NOT invent facts. Output JSON: {"summary": "...", "key_concepts": [...], "study_prompts": [{"topic": "...", "prompt": "..."}]}`
          },
          { role: "user", content: extractedText.substring(0, analysisTextLimit) }
        ],
        max_tokens: userPlan === "pro" ? 4000 : 2500,
        temperature: 0.5
      })
    });

    let summary = extractedText.substring(0, 1000);
    let studyPrompts: Array<{topic: string; prompt: string}> = [];

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const summaryContent = summaryData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = summaryContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary || summary;
          studyPrompts = parsed.study_prompts || [];
        }
      } catch (e) {
        summary = summaryContent.substring(0, 1000);
      }
    }

    // Generate TTS audio
    console.log("Background: Generating audio...");
    
    let ttsText = summary.trim();
    let translationApplied = false;

    // Translate if needed
    if (language !== "en") {
      try {
        const targetLabel = languageLabelMap[language] || "English";
        const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `Translate to ${targetLabel}. Output ONLY the translation.` },
              { role: "user", content: `Translate (max ${maxTtsChars} chars): ${ttsText}` }
            ],
            max_tokens: Math.ceil(maxTtsChars / 3)
          })
        });
        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          const translated = (translateData.choices?.[0]?.message?.content || "").trim();
          if (translated) { ttsText = translated; translationApplied = true; }
        }
      } catch (e) { console.warn("Translation error:", e); }
    }

    ttsText = ttsText.replace(/\s+/g, " ").trim().substring(0, maxTtsChars);
    
    const YARNGPT_API_KEY = Deno.env.get("YARNGPT_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    let audioBuffer: ArrayBuffer | null = null;
    let ttsProvider = "none";
    let voiceUsed = "";
    let chunksGenerated = 0;
    const failedProviders: string[] = [];
    const isNigerianLanguage = ["yo", "ha", "ig", "pcm"].includes(language.toLowerCase());

    // TRY 1: YarnGPT
    if (YARNGPT_API_KEY) {
      const result = await generateYarngptAudio(ttsText, language, YARNGPT_API_KEY, maxChunks);
      if (result.buffer) {
        audioBuffer = result.buffer;
        ttsProvider = "yarngpt";
        voiceUsed = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
        chunksGenerated = result.chunksGenerated;
      } else { failedProviders.push(`yarngpt (${result.error || "failed"})`); }
    }

    // TRY 2: Gemini TTS
    if (!audioBuffer) {
      const geminiAudio = await generateGeminiTTSAudio(ttsText, language);
      if (geminiAudio && geminiAudio.byteLength > 1024) {
        audioBuffer = geminiAudio;
        ttsProvider = "gemini";
        voiceUsed = geminiVoiceMap[language] || geminiVoiceMap["en"];
        chunksGenerated = 1;
      } else { failedProviders.push("gemini"); }
    }

    // TRY 3: ElevenLabs (English only)
    if (!audioBuffer && ELEVENLABS_API_KEY && !isNigerianLanguage) {
      try {
        const elevenVoice = elevenLabsVoiceMap["en"];
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ text: ttsText, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
        });
        if (response.ok) {
          audioBuffer = await response.arrayBuffer();
          ttsProvider = "elevenlabs";
          voiceUsed = elevenVoice;
          chunksGenerated = 1;
        } else { failedProviders.push("elevenlabs"); }
      } catch (e) { failedProviders.push("elevenlabs"); }
    }

    const ttsMetadata: TTSMetadata = {
      tts_provider: ttsProvider,
      requested_language: language,
      translation_applied: translationApplied,
      failed_providers: failedProviders,
      tts_text_length: ttsText.length,
      tts_text_preview: ttsText.substring(0, 100),
      audio_size_bytes: audioBuffer?.byteLength || 0,
      chunks_generated: chunksGenerated,
      processed_at: new Date().toISOString(),
      voice_used: voiceUsed,
      file_type: fileType
    };

    let audioPath: string | null = null;
    let audioDurationSeconds = 0;

    if (audioBuffer && audioBuffer.byteLength > 1024) {
      const contentType = ttsProvider === "gemini" ? "audio/wav" : "audio/mpeg";
      const fileExt = ttsProvider === "gemini" ? "wav" : "mp3";
      const audioBlob = new Blob([audioBuffer], { type: contentType });
      const wordCount = ttsText.split(/\s+/).length;
      audioDurationSeconds = Math.round(wordCount / 2.5);

      audioPath = `${document.user_id}/${documentId}/audio.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from("talkpdf").upload(audioPath, audioBlob, { contentType, upsert: true });
      if (uploadError) { console.warn("Audio upload failed:", uploadError); audioPath = null; }
    }

    // Update document
    await supabase.from("documents").update({
      status: "ready",
      summary,
      study_prompts: studyPrompts,
      page_contents: pageContents.length > 0 ? pageContents : [],
      page_count: pageCount > 0 ? pageCount : null,
      audio_url: audioPath,
      audio_duration_seconds: audioDurationSeconds,
      audio_language: language,
      tts_metadata: ttsMetadata
    }).eq("id", documentId);

    // Track usage
    const { data: existingUpload } = await supabase.from("usage_tracking").select("id")
      .eq("user_id", document.user_id).eq("action_type", "pdf_upload").contains("metadata", { document_id: documentId }).maybeSingle();
    if (!existingUpload) {
      await supabase.from("usage_tracking").insert({ user_id: document.user_id, action_type: "pdf_upload", metadata: { document_id: documentId, file_type: fileType } });
    }

    if (audioBuffer && audioDurationSeconds > 0) {
      const { data: existingAudio } = await supabase.from("usage_tracking").select("id")
        .eq("user_id", document.user_id).eq("action_type", "audio_conversion").contains("metadata", { document_id: documentId }).maybeSingle();
      if (!existingAudio) {
        await supabase.from("usage_tracking").insert({ user_id: document.user_id, action_type: "audio_conversion", audio_minutes_used: audioDurationSeconds / 60, metadata: { document_id: documentId, tts_provider: ttsProvider } });
      }
    }

    console.log("Background processing complete:", documentId);
  } catch (error) {
    console.error("Background processing error:", error);
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
  }
}

// Split text into chunks at sentence boundaries
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = "";
  
  for (const sentence of sentences) {
    if ((currentChunk + " " + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? " " : "") + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      // If single sentence is too long, split by words
      if (sentence.length > maxLength) {
        const words = sentence.split(/\s+/);
        currentChunk = "";
        for (const word of words) {
          if ((currentChunk + " " + word).length <= maxLength) {
            currentChunk += (currentChunk ? " " : "") + word;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  
  return chunks;
}

// Concatenate multiple audio buffers into one
function concatenateAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  
  return result.buffer;
}

// Generate audio using YarnGPT API (Primary TTS provider for Nigerian languages)
// Reference: https://yarngpt.ai/docs
async function generateYarngptAudio(
  text: string,
  language: string,
  apiKey: string,
  maxChunks: number = 1
): Promise<{ buffer: ArrayBuffer | null; chunksGenerated: number; error?: string }> {
  const voice = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
  const chunks = splitIntoChunks(text, 2000); // YarnGPT chunk limit
  const chunksToProcess = chunks.slice(0, maxChunks);
  const audioBuffers: ArrayBuffer[] = [];
  
  console.log(`YarnGPT: Processing ${chunksToProcess.length} of ${chunks.length} chunks with voice: ${voice}`);
  
  for (let i = 0; i < chunksToProcess.length; i++) {
    const chunk = chunksToProcess[i];
    console.log(`YarnGPT: Processing chunk ${i + 1}/${chunksToProcess.length} (${chunk.length} chars)`);
    
    try {
      const response = await fetch("https://yarngpt.ai/api/v1/tts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunk,
          voice: voice,
          response_format: "mp3"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`YarnGPT chunk ${i + 1} failed:`, response.status, errorText.substring(0, 200));
        return { buffer: null, chunksGenerated: i, error: `Status ${response.status}: ${errorText.substring(0, 100)}` };
      }
      
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1024) {
          audioBuffers.push(buffer);
        } else {
          console.warn(`YarnGPT chunk ${i + 1}: audio too small (${buffer.byteLength} bytes)`);
          return { buffer: null, chunksGenerated: i, error: "Audio too small" };
        }
      } else {
        const responseText = await response.text();
        console.warn(`YarnGPT chunk ${i + 1}: unexpected content-type`, contentType, responseText.substring(0, 100));
        return { buffer: null, chunksGenerated: i, error: `Unexpected response: ${contentType}` };
      }
    } catch (error) {
      console.warn(`YarnGPT chunk ${i + 1} error:`, error instanceof Error ? error.message : String(error));
      return { buffer: null, chunksGenerated: i, error: error instanceof Error ? error.message : "Network error" };
    }
  }
  
  if (audioBuffers.length === 0) {
    return { buffer: null, chunksGenerated: 0, error: "No audio generated" };
  }
  
  // Concatenate all chunks
  const finalBuffer = concatenateAudioBuffers(audioBuffers);
  console.log(`YarnGPT: Successfully generated ${audioBuffers.length} chunks, total size: ${finalBuffer.byteLength} bytes`);
  
  return { buffer: finalBuffer, chunksGenerated: audioBuffers.length };
}

// Add WAV header to raw PCM data from Gemini TTS
// Gemini returns raw PCM (24kHz, 16-bit, mono) which browsers can't play without a header
function addWavHeader(
  pcmBuffer: ArrayBuffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): ArrayBuffer {
  const pcmData = new Uint8Array(pcmBuffer);
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  
  // RIFF header
  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);  // File size - 8
  view.setUint32(8, 0x57415645, false);  // "WAVE"
  
  // fmt chunk
  view.setUint32(12, 0x666D7420, false);  // "fmt "
  view.setUint32(16, 16, true);  // Chunk size (16 for PCM)
  view.setUint16(20, 1, true);   // Audio format (1 = PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  
  // data chunk
  view.setUint32(36, 0x64617461, false);  // "data"
  view.setUint32(40, pcmData.length, true);
  
  // Combine header and PCM data
  const result = new Uint8Array(44 + pcmData.length);
  result.set(new Uint8Array(wavHeader), 0);
  result.set(pcmData, 44);
  
  return result.buffer;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cleanup old rate limit entries
  cleanupRateLimits();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authentication check - require valid JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use getUser() to validate the JWT token
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("Auth error:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting check
    const rateLimit = checkRateLimit(userId, "process-pdf", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    const { documentId, language = "en" }: ProcessRequest = await req.json();

    console.log("Processing document:", documentId, "Language:", language, "User:", userId);

    // Use service role for privileged operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, file_name, file_url")
      .eq("id", documentId)
      .eq("user_id", userId) // Verify document belongs to authenticated user
      .maybeSingle();

    if (docError || !document) {
      console.error("Document access error:", docError?.message || "Not found");
      return new Response(
        JSON.stringify({ error: "Unable to access document" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase.from("documents").update({ status: "processing", audio_language: language }).eq("id", documentId);

    // Start background processing using EdgeRuntime.waitUntil
    EdgeRuntime.waitUntil(
      processDocumentInBackground(
        documentId,
        userId,
        language,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        LOVABLE_API_KEY || ""
      ).catch((error) => {
        console.error("Background processing failed:", error);
        // Update document status to error
        createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          .from("documents")
          .update({ status: "error" })
          .eq("id", documentId);
      })
    );

    // Return immediately - processing continues in background
    console.log("Document processing started in background:", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        status: "processing",
        message: "Document processing started. The page will update when ready."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Process error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Generate audio using Google Gemini TTS
async function generateGeminiTTSAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return null;

  const voice = geminiVoiceMap[language] || geminiVoiceMap["en"];
  const ttsText = text.substring(0, 5000);

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ttsText }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) return null;

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    
    return addWavHeader(bytes.buffer, 24000, 1, 16);
  } catch (e) {
    console.error("Gemini TTS error:", e);
    return null;
  }
}

// Helper function to convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
