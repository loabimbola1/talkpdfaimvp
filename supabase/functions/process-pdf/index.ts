import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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

const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,
  maxRequests: 5,
};

const yarngptVoiceMap: Record<string, string> = {
  "yo": "Adaora",
  "ha": "Umar",
  "ig": "Chinenye",
  "en": "Femi",
  "pcm": "Tayo",
};

const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",
  "yo": "Kore",
  "ha": "Kore",
  "ig": "Kore",
  "pcm": "Puck",
};

const elevenLabsVoiceMap: Record<string, string> = {
  "en": "onwK4e9ZLuTAKqWW03F9",
};

const PLAN_TTS_LIMITS: Record<string, number> = {
  "free": 2000,
  "plus": 6000,
  "pro": 15000,
};

// Safe base64 encoding for large binary blobs using Deno's standard library
function blobToBase64Safe(arrayBuffer: ArrayBuffer): string {
  return base64Encode(new Uint8Array(arrayBuffer));
}

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

    // Convert file to base64 safely (no stack overflow)
    const fileArrayBuffer = await fileData.arrayBuffer();
    const fileBase64 = blobToBase64Safe(fileArrayBuffer);
    console.log(`Background: File base64 length: ${fileBase64.length}`);

    // =========================================================================
    // STEP 1: Extract text from the file using Gemini's native PDF understanding
    // We send the raw PDF binary to Gemini so it reads the actual document,
    // preventing hallucination from AI pre-trained knowledge.
    // =========================================================================
    const mimeType = isWordDoc ? "application/pdf" : "application/pdf";
    const maxPages = userPlan === "pro" ? 50 : (userPlan === "plus" ? 30 : 0);

    // For Plus/Pro: Extract page-by-page content directly from the PDF binary
    let pageContents: Array<{ page: number; text: string; chapter?: string }> = [];
    let pageCount = 0;
    let extractedText = "";

    // STEP 1a: Always extract full text first (reliable, no JSON issues)
    console.log("Background: Extracting full text...");
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a document text extractor. Extract ALL text from the provided document EXACTLY as it appears.

CRITICAL RULES:
1. ONLY extract text that EXISTS in the document - DO NOT invent or hallucinate content.
2. DO NOT add explanations, commentary, or additional information.
3. DO NOT rephrase or paraphrase - preserve the original wording exactly.
4. If you cannot read certain parts, indicate with [UNREADABLE] rather than guessing.
5. Preserve the document's original structure and order.
6. Output ONLY the extracted text from the document, nothing else.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all text content from this document." },
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
        max_tokens: 16000,
        temperature: 0.1
      })
    });

    if (extractResponse.ok) {
      const extractData = await extractResponse.json();
      extractedText = extractData.choices?.[0]?.message?.content || "";
      console.log(`Background: Full text extracted, length: ${extractedText.length}`);
    } else {
      const errText = await extractResponse.text();
      console.error("AI extraction failed:", extractResponse.status, errText.substring(0, 300));
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    // STEP 1b: For Plus/Pro users, identify page boundaries from the extracted text
    if (maxPages > 0 && extractedText.length >= 50) {
      console.log(`Background: Identifying page boundaries for ${userPlan} user (max ${maxPages} pages)...`);
      const pageBoundaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              content: `You are a document page analyzer. Given a PDF document, identify the page boundaries.

For each page, provide:
- page: the page number (1-indexed)
- start: the first 6-8 words on that page (exact quote from document)
- chapter: chapter/section title if one starts on this page (or null)

Output valid JSON array only, no markdown fences:
[{"page":1,"start":"first words on page one","chapter":"Title if any"},{"page":2,"start":"first words on page two","chapter":null}]

Analyze up to ${maxPages} pages. Be precise with the starting words - they must match the document exactly.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Identify page boundaries in this document." },
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
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      if (pageBoundaryResponse.ok) {
        const boundaryData = await pageBoundaryResponse.json();
        const rawBoundary = boundaryData.choices?.[0]?.message?.content || "";
        try {
          const cleaned = rawBoundary.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const boundaries = JSON.parse(jsonMatch[0]) as Array<{ page: number; start: string; chapter?: string | null }>;
            console.log(`Background: Found ${boundaries.length} page boundaries`);

            // Split extractedText using the boundary markers
            for (let i = 0; i < boundaries.length && i < maxPages; i++) {
              const boundary = boundaries[i];
              const nextBoundary = boundaries[i + 1];

              // Find start position in text
              const startMarker = boundary.start?.trim();
              let startIdx = 0;
              if (startMarker && i > 0) {
                const foundIdx = extractedText.indexOf(startMarker, i > 0 ? (pageContents[i - 1] ? extractedText.indexOf(pageContents[i - 1].text) + pageContents[i - 1].text.length - 50 : 0) : 0);
                if (foundIdx >= 0) startIdx = foundIdx;
              } else if (i === 0) {
                startIdx = 0;
              }

              // Find end position
              let endIdx = extractedText.length;
              if (nextBoundary?.start) {
                const nextMarker = nextBoundary.start.trim();
                const foundEnd = extractedText.indexOf(nextMarker, startIdx + 10);
                if (foundEnd >= 0) endIdx = foundEnd;
              }

              const pageText = extractedText.substring(startIdx, endIdx).trim();
              if (pageText.length > 10) {
                pageContents.push({
                  page: boundary.page || (i + 1),
                  text: pageText,
                  chapter: boundary.chapter || undefined
                });
              }
            }

            // If boundary matching failed, fall back to even splitting
            if (pageContents.length === 0 && boundaries.length > 0) {
              console.log("Background: Boundary matching failed, splitting text evenly...");
              const chunkSize = Math.ceil(extractedText.length / boundaries.length);
              for (let i = 0; i < boundaries.length && i < maxPages; i++) {
                const start = i * chunkSize;
                const end = Math.min((i + 1) * chunkSize, extractedText.length);
                const pageText = extractedText.substring(start, end).trim();
                if (pageText.length > 10) {
                  pageContents.push({
                    page: boundaries[i].page || (i + 1),
                    text: pageText,
                    chapter: boundaries[i].chapter || undefined
                  });
                }
              }
            }

            pageCount = pageContents.length;
            console.log(`Background: Successfully split into ${pageCount} pages`);
          }
        } catch (e) {
          console.warn("Page boundary parse error:", e);
        }
      }
    }

    // Text was already extracted in Step 1a above

    console.log("Background: Extracted text length:", extractedText.length);

    if (!extractedText || extractedText.length < 50) {
      console.error("Background: Extraction produced insufficient text");
      await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
      return;
    }

    // =========================================================================
    // STEP 2: Generate comprehensive summary and study prompts
    // Use the full extracted text for context-aware summarization
    // =========================================================================
    const analysisTextLimit = userPlan === "pro" ? 12000 : (userPlan === "plus" ? 8000 : 5000);
    const textForAnalysis = extractedText.substring(0, analysisTextLimit);

    console.log("Background: Generating summary...");
    const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an academic content analyst creating study materials for Nigerian students.

Your task: Create a COMPREHENSIVE summary and study guide from the provided document text.

CRITICAL RULES:
1. Base your summary ONLY on the actual document content provided - do NOT add external knowledge.
2. The summary must cover the document from BEGINNING to END, not just the first few paragraphs.
3. Include ALL major topics, sections, and key points from the entire document.
4. Study prompts should test understanding of specific concepts from different parts of the document.

Output valid JSON (no markdown fences):
{
  "summary": "A comprehensive summary covering the entire document. For ${userPlan} plan: ${userPlan === "pro" ? "Detailed 800-1200 word summary covering every section" : userPlan === "plus" ? "Thorough 400-700 word summary covering all major sections" : "Concise 200-350 word summary covering main points"}.",
  "study_prompts": [
    {"topic": "Specific concept from the document", "prompt": "Question testing understanding of this concept"}
  ]
}

Generate ${userPlan === "pro" ? "8-12" : userPlan === "plus" ? "5-8" : "3-5"} study prompts covering different sections of the document.`
          },
          { role: "user", content: textForAnalysis }
        ],
        max_tokens: userPlan === "pro" ? 4000 : (userPlan === "plus" ? 3000 : 2000),
        temperature: 0.3
      })
    });

    let summary = "";
    let studyPrompts: Array<{ topic: string; prompt: string }> = [];

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const summaryContent = summaryData.choices?.[0]?.message?.content || "";
      try {
        const cleaned = summaryContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          summary = parsed.summary || "";
          studyPrompts = Array.isArray(parsed.study_prompts) ? parsed.study_prompts : [];
        }
      } catch (e) {
        console.warn("Summary parse error, using raw:", e);
        summary = summaryContent.substring(0, 2000);
      }
    }

    // Fallback if summary is empty
    if (!summary || summary.length < 50) {
      summary = extractedText.substring(0, 1500);
    }

    console.log(`Background: Summary length: ${summary.length}, Study prompts: ${studyPrompts.length}`);

    // =========================================================================
    // STEP 3: Generate TTS audio from the summary
    // =========================================================================
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
              { role: "system", content: `Translate the following text to ${targetLabel}. Output ONLY the translation, nothing else.` },
              { role: "user", content: ttsText.substring(0, maxTtsChars) }
            ],
            max_tokens: Math.ceil(maxTtsChars / 2),
            temperature: 0.3
          })
        });
        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          const translated = (translateData.choices?.[0]?.message?.content || "").trim();
          if (translated && translated.length > 20) {
            ttsText = translated;
            translationApplied = true;
          }
        }
      } catch (e) {
        console.warn("Translation error:", e);
      }
    }

    ttsText = ttsText.replace(/\s+/g, " ").trim().substring(0, maxTtsChars);
    console.log(`Background: TTS text length after processing: ${ttsText.length}`);

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
      if (result.buffer && result.buffer.byteLength > 1024) {
        audioBuffer = result.buffer;
        ttsProvider = "yarngpt";
        voiceUsed = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
        chunksGenerated = result.chunksGenerated;
        console.log(`Background: YarnGPT audio generated, ${audioBuffer.byteLength} bytes`);
      } else {
        failedProviders.push(`yarngpt (${result.error || "failed"})`);
        console.warn("Background: YarnGPT failed:", result.error);
      }
    }

    // TRY 2: Gemini TTS
    if (!audioBuffer) {
      console.log("Background: Trying Gemini TTS...");
      const geminiAudio = await generateGeminiTTSAudio(ttsText, language);
      if (geminiAudio && geminiAudio.byteLength > 1024) {
        audioBuffer = geminiAudio;
        ttsProvider = "gemini";
        voiceUsed = geminiVoiceMap[language] || geminiVoiceMap["en"];
        chunksGenerated = 1;
        console.log(`Background: Gemini audio generated, ${audioBuffer.byteLength} bytes`);
      } else {
        failedProviders.push("gemini");
        console.warn("Background: Gemini TTS failed");
      }
    }

    // TRY 3: ElevenLabs (English only)
    if (!audioBuffer && ELEVENLABS_API_KEY && !isNigerianLanguage) {
      console.log("Background: Trying ElevenLabs...");
      try {
        const elevenVoice = elevenLabsVoiceMap["en"];
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText.substring(0, 5000),
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        });
        if (response.ok) {
          const buf = await response.arrayBuffer();
          if (buf.byteLength > 1024) {
            audioBuffer = buf;
            ttsProvider = "elevenlabs";
            voiceUsed = elevenVoice;
            chunksGenerated = 1;
            console.log(`Background: ElevenLabs audio generated, ${audioBuffer.byteLength} bytes`);
          } else {
            failedProviders.push("elevenlabs (too small)");
          }
        } else {
          failedProviders.push(`elevenlabs (${response.status})`);
        }
      } catch (e) {
        failedProviders.push("elevenlabs (error)");
      }
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

      const { error: uploadError } = await supabase.storage
        .from("talkpdf")
        .upload(audioPath, audioBlob, { contentType, upsert: true });

      if (uploadError) {
        console.warn("Audio upload failed:", uploadError);
        audioPath = null;
      } else {
        console.log(`Background: Audio uploaded to ${audioPath}`);
      }
    } else {
      console.warn(`Background: No valid audio generated. Failed providers: ${failedProviders.join(", ")}`);
    }

    // Update document with all results
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
      .eq("user_id", document.user_id).eq("action_type", "pdf_upload")
      .contains("metadata", { document_id: documentId }).maybeSingle();
    if (!existingUpload) {
      await supabase.from("usage_tracking").insert({
        user_id: document.user_id,
        action_type: "pdf_upload",
        metadata: { document_id: documentId, file_type: fileType }
      });
    }

    if (audioBuffer && audioDurationSeconds > 0) {
      const { data: existingAudio } = await supabase.from("usage_tracking").select("id")
        .eq("user_id", document.user_id).eq("action_type", "audio_conversion")
        .contains("metadata", { document_id: documentId }).maybeSingle();
      if (!existingAudio) {
        await supabase.from("usage_tracking").insert({
          user_id: document.user_id,
          action_type: "audio_conversion",
          audio_minutes_used: audioDurationSeconds / 60,
          metadata: { document_id: documentId, tts_provider: ttsProvider }
        });
      }
    }

    console.log(`Background processing complete: ${documentId}, audio: ${audioPath ? "YES" : "NO"}, pages: ${pageCount}`);
  } catch (error) {
    console.error("Background processing error:", error);
    const supabase = createClient(supabaseUrl, serviceRoleKey);
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

// Generate audio using YarnGPT API
async function generateYarngptAudio(
  text: string,
  language: string,
  apiKey: string,
  maxChunks: number = 1
): Promise<{ buffer: ArrayBuffer | null; chunksGenerated: number; error?: string }> {
  const voice = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
  const chunks = splitIntoChunks(text, 2000);
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
        return { buffer: null, chunksGenerated: i, error: `Status ${response.status}` };
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
        console.warn(`YarnGPT chunk ${i + 1}: unexpected content-type`, contentType);
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

  const finalBuffer = concatenateAudioBuffers(audioBuffers);
  console.log(`YarnGPT: Successfully generated ${audioBuffers.length} chunks, total size: ${finalBuffer.byteLength} bytes`);
  return { buffer: finalBuffer, chunksGenerated: audioBuffers.length };
}

// Add WAV header to raw PCM data from Gemini TTS
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

  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);  // "WAVE"
  view.setUint32(12, 0x666D7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmData.length, true);

  const result = new Uint8Array(44 + pcmData.length);
  result.set(new Uint8Array(wavHeader), 0);
  result.set(pcmData, 44);
  return result.buffer;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  cleanupRateLimits();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing configuration");
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authentication check
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

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // Rate limiting
    const rateLimit = checkRateLimit(userId, "process-pdf", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    const { documentId, language = "en" }: ProcessRequest = await req.json();
    console.log("Processing document:", documentId, "Language:", language, "User:", userId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, file_name, file_url")
      .eq("id", documentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Unable to access document" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase.from("documents").update({
      status: "processing",
      audio_language: language
    }).eq("id", documentId);

    // Start background processing
    EdgeRuntime.waitUntil(
      processDocumentInBackground(
        documentId, userId, language,
        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY || ""
      ).catch((error) => {
        console.error("Background processing failed:", error);
        createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
          .from("documents")
          .update({ status: "error" })
          .eq("id", documentId);
      })
    );

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
      JSON.stringify({ error: "An error occurred processing your document" }),
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
    console.log(`Gemini TTS: Generating with voice ${voice}, text length ${ttsText.length}...`);
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: ttsText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini TTS error: ${response.status}`, errText.substring(0, 300));
      return null;
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      console.warn("Gemini TTS: No audio data in response");
      return null;
    }

    // Decode base64 to bytes
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wavBuffer = addWavHeader(bytes.buffer, 24000, 1, 16);
    console.log(`Gemini TTS: Generated WAV audio, ${wavBuffer.byteLength} bytes`);
    return wavBuffer;
  } catch (e) {
    console.error("Gemini TTS error:", e);
    return null;
  }
}
