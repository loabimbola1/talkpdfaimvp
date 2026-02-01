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

// Spitch voice mapping for Nigerian languages (Primary TTS provider)
// Reference: https://docs.spitch.app
const spitchVoiceMap: Record<string, { voice: string; language: string }> = {
  "yo": { voice: "sade", language: "yo" },     // Yoruba - feminine, energetic
  "ha": { voice: "zainab", language: "ha" },   // Hausa - feminine, clear
  "ig": { voice: "ngozi", language: "ig" },    // Igbo - feminine, soft
  "en": { voice: "lucy", language: "en" },     // English - feminine, very clear
  "pcm": { voice: "lucy", language: "en" },    // Pidgin - uses English voice
};

// ElevenLabs voice mapping for Nigerian-sounding voices (Final fallback)
// Using Olufunmilola for authentic Nigerian accent
const elevenLabsVoiceMap: Record<string, string> = {
  "en": "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent English
  "yo": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "ha": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "ig": "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  "pcm": "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
};

// Gemini TTS voice mapping
// Reference: https://ai.google.dev/gemini-api/docs/speech-generation
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",   // Informative - good for educational content
  "yo": "Kore",     // Firm - clear pronunciation
  "ha": "Kore",     // Firm - clear pronunciation
  "ig": "Kore",     // Firm - clear pronunciation
  "pcm": "Puck",    // Upbeat - good for Pidgin
};

// Plan-based TTS character limits
const PLAN_TTS_LIMITS: Record<string, number> = {
  "free": 1400,    // Short summary only
  "plus": 5000,    // Extended summary (~10 min audio)
  "pro": 15000,    // Comprehensive (~25 min audio)
};

// TTS chunk limits
const SPITCH_CHUNK_LIMIT = 2000;

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

// Generate audio using Spitch API (Primary TTS provider for Nigerian languages)
async function generateSpitchAudio(
  text: string,
  language: string,
  apiKey: string,
  maxChunks: number = 1
): Promise<{ buffer: ArrayBuffer | null; chunksGenerated: number; error?: string }> {
  const config = spitchVoiceMap[language.toLowerCase()] || spitchVoiceMap["en"];
  const chunks = splitIntoChunks(text, SPITCH_CHUNK_LIMIT);
  const chunksToProcess = chunks.slice(0, maxChunks);
  const audioBuffers: ArrayBuffer[] = [];
  
  console.log(`Spitch: Processing ${chunksToProcess.length} of ${chunks.length} chunks with voice: ${config.voice}`);
  
  for (let i = 0; i < chunksToProcess.length; i++) {
    const chunk = chunksToProcess[i];
    console.log(`Spitch: Processing chunk ${i + 1}/${chunksToProcess.length} (${chunk.length} chars)`);
    
    try {
      const response = await fetch("https://api.spitch.app/v1/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunk,
          voice: config.voice,
          language: config.language,
          format: "mp3"
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Spitch chunk ${i + 1} failed:`, response.status, errorText.substring(0, 200));
        return { buffer: null, chunksGenerated: i, error: `Status ${response.status}: ${errorText.substring(0, 100)}` };
      }
      
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1024) {
          audioBuffers.push(buffer);
        } else {
          console.warn(`Spitch chunk ${i + 1}: audio too small (${buffer.byteLength} bytes)`);
          return { buffer: null, chunksGenerated: i, error: "Audio too small" };
        }
      } else {
        const responseText = await response.text();
        console.warn(`Spitch chunk ${i + 1}: unexpected content-type`, contentType, responseText.substring(0, 100));
        return { buffer: null, chunksGenerated: i, error: `Unexpected response: ${contentType}` };
      }
    } catch (error) {
      console.warn(`Spitch chunk ${i + 1} error:`, error instanceof Error ? error.message : String(error));
      return { buffer: null, chunksGenerated: i, error: error instanceof Error ? error.message : "Network error" };
    }
  }
  
  if (audioBuffers.length === 0) {
    return { buffer: null, chunksGenerated: 0, error: "No audio generated" };
  }
  
  // Concatenate all chunks
  const finalBuffer = concatenateAudioBuffers(audioBuffers);
  console.log(`Spitch: Successfully generated ${audioBuffers.length} chunks, total size: ${finalBuffer.byteLength} bytes`);
  
  return { buffer: finalBuffer, chunksGenerated: audioBuffers.length };
}

// Generate audio using Google Gemini TTS (Secondary fallback)
// Reference: https://ai.google.dev/gemini-api/docs/speech-generation
async function generateGeminiTTSAudio(
  text: string,
  language: string = "en"
): Promise<ArrayBuffer | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    console.log("Gemini API key not configured");
    return null;
  }

  const voice = geminiVoiceMap[language] || geminiVoiceMap["en"];
  
  // Limit text to 5000 chars for TTS
  const ttsText = text.substring(0, 5000);

  try {
    console.log(`Gemini TTS: Generating audio with voice ${voice} for ${ttsText.length} chars...`);
    
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: ttsText }]
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voice
                }
              }
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini TTS error: ${response.status}`, errorText.substring(0, 500));
      return null;
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      console.warn("Gemini TTS: No audio data in response. Keys:", JSON.stringify(Object.keys(data)));
      return null;
    }

    // Gemini returns base64 PCM audio - decode to ArrayBuffer
    // Note: This is raw PCM (24kHz, 16-bit, mono) but can be played as-is by most players
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`Gemini TTS: Successfully generated audio, size: ${bytes.length} bytes`);
    return bytes.buffer;
  } catch (error) {
    console.error("Gemini TTS error:", error instanceof Error ? error.message : String(error));
    return null;
  }
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

    // Use service role for privileged operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { documentId, language = "en" }: ProcessRequest = await req.json();

    console.log("Processing document:", documentId, "Language:", language, "User:", userId);

    // Get document details and verify ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId) // Verify document belongs to authenticated user
      .maybeSingle();

    if (docError || !document) {
      console.error("Document not found or access denied:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect file type (PDF or Word)
    const fileName = document.file_name.toLowerCase();
    const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
    const fileType = isWordDoc ? "word" : "pdf";
    const mimeType = isWordDoc 
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      : "application/pdf";
    
    console.log(`File type detected: ${fileType} (${mimeType})`);

    // Get user's subscription plan for TTS limits
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("user_id", userId)
      .single();
    
    const userPlan = userProfile?.subscription_plan || "free";
    const maxTtsChars = PLAN_TTS_LIMITS[userPlan] || PLAN_TTS_LIMITS["free"];
    
    // Calculate max chunks based on plan
    const maxChunks = userPlan === "pro" ? 8 : (userPlan === "plus" ? 3 : 1);
    
    console.log(`User plan: ${userPlan}, Max TTS chars: ${maxTtsChars}, Max chunks: ${maxChunks}`);

    // Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing", audio_language: language })
      .eq("id", documentId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("talkpdf")
      .download(document.file_url);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to download file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text from file using AI
    const fileBase64 = await blobToBase64(fileData);
    
    console.log(`Extracting text from ${fileType}...`);
    
    let extractResponse: Response;
    
    if (isWordDoc) {
      // For Word documents, extract text by reading the document structure
      console.log("Using Word document extraction approach...");
      extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a document extraction assistant. Extract ALL text content from the provided document. Preserve the structure and order of the content. Focus on extracting educational content, key concepts, and important information that students would need to learn. Output only the extracted text, no commentary.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract all text content from this Word document (${document.file_name}). Include all educational content, definitions, concepts, and key points.`
                },
                {
                  type: "file",
                  file: {
                    filename: document.file_name.replace(/\.docx?$/i, '.pdf'),
                    file_data: `data:application/pdf;base64,${fileBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 16000
        })
      });
      
      // If the PDF-disguised approach fails, try a simpler text-based prompt
      if (!extractResponse.ok) {
        console.log("PDF approach failed for Word doc, trying text-based extraction...");
        extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a document extraction assistant. The user has uploaded a Word document (.docx). Extract ALL text content, preserving structure. Focus on educational content.`
              },
              {
                role: "user",
                content: `I've uploaded a Word document named "${document.file_name}". Please help me extract the text content. Here is the base64 encoded content of the document (this is a .docx file): ${fileBase64.substring(0, 100000)}`
              }
            ],
            max_tokens: 16000
          })
        });
      }
    } else {
      // PDF extraction using file attachment (works reliably)
      extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a document extraction assistant. Extract ALL text content from the provided PDF document. Preserve the structure and order of the content. Focus on extracting educational content, key concepts, and important information that students would need to learn. Output only the extracted text, no commentary.`
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract all text content from this PDF document. Include all educational content, definitions, concepts, and key points.`
                },
                {
                  type: "file",
                  file: {
                    filename: document.file_name,
                    file_data: `data:application/pdf;base64,${fileBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 16000
        })
      });
    }

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("AI extraction failed:", errorText);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: `Failed to extract text from ${fileType}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.choices?.[0]?.message?.content || "";

    console.log("Extracted text length:", extractedText.length);

    if (!extractedText || extractedText.length < 50) {
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: `Could not extract text from ${fileType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate summary and study prompts - MORE COMPREHENSIVE for paid plans
    console.log("Generating summary and study prompts...");
    
    // Determine how much text to analyze based on plan
    const analysisTextLimit = userPlan === "pro" ? 15000 : (userPlan === "plus" ? 8000 : 5000);
    
    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an educational content analyzer for Nigerian students preparing for WAEC and JAMB exams. Create a comprehensive summary and study prompts from the document content.
            
The user is on the "${userPlan}" plan:
${userPlan === "free" ? "- Create a concise summary (300-500 words) that covers key points" : ""}
${userPlan === "plus" ? "- Create a detailed summary (800-1200 words) that covers all important concepts thoroughly" : ""}
${userPlan === "pro" ? "- Create a comprehensive, page-by-page style summary (1500-2500 words) that explains concepts in depth like reading the actual textbook" : ""}

Output a JSON object with this structure:
{
  "summary": "Summary as described above",
  "key_concepts": ["concept1", "concept2", ...],
  "study_prompts": [
    {"topic": "Topic name", "prompt": "Explain..."},
    ...
  ]
}

Create ${userPlan === "pro" ? "8-10" : (userPlan === "plus" ? "5-7" : "3-5")} study prompts that will help students test their understanding.`
          },
          {
            role: "user",
            content: `Analyze this document content and create a summary with study prompts:\n\n${extractedText.substring(0, analysisTextLimit)}`
          }
        ],
        max_tokens: userPlan === "pro" ? 6000 : (userPlan === "plus" ? 4000 : 2000)
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
        console.log("Could not parse summary JSON, using raw text");
        summary = summaryContent.substring(0, 1000);
      }
    }

    // Generate audio using TTS - Spitch -> Gemini -> ElevenLabs fallback chain
    console.log("Generating audio with TTS...");
    
    let audioPath: string | null = null;
    let audioDurationSeconds = 0;
    
    // Build TTS script based on user's plan
    let ttsText = summary.trim();
    let translationApplied = false;

    // Translate if non-English
    if (language !== "en" && LOVABLE_API_KEY) {
      try {
        console.log(`Translating TTS script to ${language} (${maxTtsChars} chars max)...`);
        const targetLabel = languageLabelMap[language] || "English";
        const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You translate text for spoken audio into ${targetLabel}. Output ONLY the translation (no quotes, no extra notes). Keep it natural and easy to listen to. Use authentic ${targetLabel} expressions where appropriate.`,
              },
              {
                role: "user",
                content: `Translate this into ${targetLabel}. Keep it under ${maxTtsChars} characters.\n\n${ttsText}`,
              },
            ],
            max_tokens: Math.ceil(maxTtsChars / 3),
          }),
        });

        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          const translated = (translateData.choices?.[0]?.message?.content || "").trim();
          if (translated) {
            ttsText = translated;
            translationApplied = true;
            console.log(`Translation successful to ${language}, length: ${ttsText.length}`);
          }
        } else {
          const errorText = await translateResponse.text();
          console.warn("Translation failed, falling back to English summary:", errorText);
        }
      } catch (e) {
        console.warn("Translation error, falling back to English summary:", e);
      }
    }

    // Apply plan-based character limit
    ttsText = ttsText.replace(/\s+/g, " ").trim();
    if (ttsText.length > maxTtsChars) {
      ttsText = ttsText.substring(0, maxTtsChars);
    }
    
    console.log(`TTS text length after plan limits: ${ttsText.length} chars (plan: ${userPlan})`);
    
    const SPITCH_API_KEY = Deno.env.get("SPITCH_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    let audioBuffer: ArrayBuffer | null = null;
    let ttsProvider = "none";
    let voiceUsed = "";
    let chunksGenerated = 0;
    const failedProviders: string[] = [];

    // TRY 1: Spitch for Nigerian languages (primary provider)
    if (SPITCH_API_KEY) {
      const config = spitchVoiceMap[language.toLowerCase()] || spitchVoiceMap["en"];
      console.log(`Attempting Spitch TTS with voice: ${config.voice} for language: ${language}...`);
      
      const result = await generateSpitchAudio(ttsText, language, SPITCH_API_KEY, maxChunks);
      
      if (result.buffer) {
        audioBuffer = result.buffer;
        ttsProvider = "spitch";
        voiceUsed = config.voice;
        chunksGenerated = result.chunksGenerated;
        console.log(`Spitch TTS successful: ${chunksGenerated} chunks, voice: ${config.voice}, language: ${language}`);
      } else {
        const errorMsg = result.error || "unknown error";
        console.warn(`Spitch failed: ${errorMsg}`);
        failedProviders.push(`spitch (${errorMsg})`);
      }
    } else {
      console.log("Spitch API key not configured, skipping");
      failedProviders.push("spitch (no API key)");
    }

    // TRY 2: Google Gemini TTS (secondary fallback)
    if (!audioBuffer) {
      console.log("Attempting Gemini TTS as fallback...");
      const geminiAudio = await generateGeminiTTSAudio(ttsText, language);
      
      if (geminiAudio && geminiAudio.byteLength > 1024) {
        audioBuffer = geminiAudio;
        ttsProvider = "gemini";
        voiceUsed = geminiVoiceMap[language] || geminiVoiceMap["en"];
        chunksGenerated = 1;
        console.log(`Gemini TTS successful: voice ${voiceUsed}, size: ${audioBuffer.byteLength} bytes`);
      } else {
        console.warn("Gemini TTS failed or returned no audio");
        failedProviders.push("gemini (no audio)");
      }
    }

    // TRY 3: ElevenLabs (final fallback with Nigerian-appropriate voices)
    if (!audioBuffer && ELEVENLABS_API_KEY) {
      try {
        console.log("Falling back to ElevenLabs TTS with language-specific voice...");
        const elevenVoice = elevenLabsVoiceMap[language] || elevenLabsVoiceMap["en"];
        console.log(`Using ElevenLabs voice: ${elevenVoice} for language: ${language}`);

        const requestElevenLabs = async (text: string) => {
          return await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}?output_format=mp3_44100_128`,
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  style: 0.3,
                  use_speaker_boost: true,
                },
              }),
            }
          );
        };
        
        let ttsAttemptText = ttsText;
        let ttsResponse = await requestElevenLabs(ttsAttemptText);

        // If quota is tight, retry with a shorter script based on remaining credits
        if (!ttsResponse.ok) {
          const errorText = await ttsResponse.clone().text();
          console.warn("ElevenLabs first attempt failed:", errorText);

          const remainingMatch = errorText.match(/You have (\d+) credits remaining/i);
          const remaining = remainingMatch ? Number(remainingMatch[1]) : null;
          if (remaining && remaining > 200) {
            const safeChars = Math.max(200, remaining - 50);
            ttsAttemptText = ttsAttemptText.substring(0, Math.min(ttsAttemptText.length, safeChars));
            console.log(`Retrying ElevenLabs with shorter text (${ttsAttemptText.length} chars)...`);
            ttsResponse = await requestElevenLabs(ttsAttemptText);
          }
        }

        if (ttsResponse.ok) {
          audioBuffer = await ttsResponse.arrayBuffer();
          ttsProvider = "elevenlabs";
          voiceUsed = elevenVoice;
          chunksGenerated = 1;
          console.log("ElevenLabs TTS successful, audio size:", audioBuffer.byteLength);
        } else {
          const errorText = await ttsResponse.clone().text();
          console.warn("ElevenLabs TTS failed:", errorText);
          failedProviders.push(`elevenlabs (${ttsResponse.status})`);
        }
      } catch (elevenLabsError) {
        console.warn("ElevenLabs TTS error:", elevenLabsError);
        failedProviders.push("elevenlabs (error)");
      }
    }

    // Log failed providers for debugging
    if (failedProviders.length > 0) {
      console.log("Failed TTS providers:", failedProviders.join(", "));
    }

    // Build TTS metadata for debugging
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

    // Upload audio if we got any
    if (audioBuffer && audioBuffer.byteLength > 1024) {
      try {
        // Determine content type based on provider
        // Gemini returns PCM, but we'll save as-is (browsers can often play it)
        const contentType = ttsProvider === "gemini" ? "audio/wav" : "audio/mpeg";
        const fileExt = ttsProvider === "gemini" ? "wav" : "mp3";
        
        const audioBlob = new Blob([audioBuffer], { type: contentType });
        
        // Calculate approximate audio duration (~150 words per minute)
        const wordCount = ttsText.split(/\s+/).length;
        audioDurationSeconds = Math.round(wordCount / 2.5);

        // Upload audio to storage
        audioPath = `${document.user_id}/${documentId}/audio.${fileExt}`;
        
        const { error: uploadError } = await supabase
          .storage
          .from("talkpdf")
          .upload(audioPath, audioBlob, {
            contentType: contentType,
            upsert: true
          });

        if (uploadError) {
          console.warn("Failed to upload audio:", uploadError);
          audioPath = null;
        } else {
          console.log(`Audio uploaded successfully (provider: ${ttsProvider}):`, audioPath);
        }
      } catch (uploadError) {
        console.warn("Audio upload error:", uploadError);
      }
    } else {
      console.warn("No TTS provider available or all failed - document will be ready without audio");
    }

    // Update document with all the generated content including TTS metadata
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        summary: summary,
        study_prompts: studyPrompts,
        audio_url: audioPath,
        audio_duration_seconds: audioDurationSeconds,
        audio_language: language,
        tts_metadata: ttsMetadata
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
    }

    // Track usage (idempotent):
    const { data: existingPdfUpload } = await supabase
      .from("usage_tracking")
      .select("id")
      .eq("user_id", document.user_id)
      .eq("action_type", "pdf_upload")
      .contains("metadata", { document_id: documentId })
      .maybeSingle();

    if (!existingPdfUpload) {
      await supabase.from("usage_tracking").insert({
        user_id: document.user_id,
        action_type: "pdf_upload",
        metadata: { document_id: documentId, file_type: fileType }
      });
    }

    // Track audio usage if audio was generated
    if (audioBuffer && audioDurationSeconds > 0) {
      const audioMinutes = audioDurationSeconds / 60;
      const { data: existingAudio } = await supabase
        .from("usage_tracking")
        .select("id")
        .eq("user_id", document.user_id)
        .eq("action_type", "audio_conversion")
        .contains("metadata", { document_id: documentId })
        .maybeSingle();

      if (!existingAudio) {
        await supabase.from("usage_tracking").insert({
          user_id: document.user_id,
          action_type: "audio_conversion",
          audio_minutes_used: audioMinutes,
          metadata: { document_id: documentId, tts_provider: ttsProvider }
        });
      }
    }

    console.log("Document processing complete:", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary: summary.substring(0, 200),
        studyPromptsCount: studyPrompts.length,
        audioGenerated: !!audioPath,
        audioProvider: ttsProvider,
        ttsMetadata
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
