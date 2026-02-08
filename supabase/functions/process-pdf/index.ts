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
  en: "English", yo: "Yoruba", ha: "Hausa", ig: "Igbo", pcm: "Nigerian Pidgin",
};

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 5 };

const yarngptVoiceMap: Record<string, string> = {
  "yo": "Adaora", "ha": "Umar", "ig": "Chinenye", "en": "Femi", "pcm": "Tayo",
};
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon", "yo": "Kore", "ha": "Kore", "ig": "Kore", "pcm": "Puck",
};
const elevenLabsVoiceMap: Record<string, string> = { "en": "onwK4e9ZLuTAKqWW03F9" };

const PLAN_TTS_LIMITS: Record<string, number> = { "free": 2000, "plus": 6000, "pro": 15000 };

// Max file size: 8MB to prevent memory crashes
const MAX_FILE_SIZE = 8 * 1024 * 1024;
// Overall background timeout: 80 seconds
const BACKGROUND_TIMEOUT_MS = 80_000;
// Individual API call timeout: 25 seconds
const API_TIMEOUT_MS = 25_000;

function blobToBase64Safe(arrayBuffer: ArrayBuffer): string {
  return base64Encode(new Uint8Array(arrayBuffer));
}

// Fetch with timeout using AbortController
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// Background processing function - optimized for speed
async function processDocumentInBackground(
  documentId: string, userId: string, language: string,
  supabaseUrl: string, serviceRoleKey: string, lovableApiKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Overall timeout - abort everything after 80s
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Background processing timeout (80s)")), BACKGROUND_TIMEOUT_MS)
  );

  try {
    await Promise.race([
      _processDocument(supabase, documentId, userId, language, lovableApiKey),
      timeoutPromise,
    ]);
  } catch (error) {
    console.error("Background processing error:", error instanceof Error ? error.message : error);
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
  }
}

async function _processDocument(
  supabase: ReturnType<typeof createClient>,
  documentId: string, userId: string, language: string, lovableApiKey: string
): Promise<void> {
  const startTime = Date.now();
  console.log("Background processing started for document:", documentId);

  // Fetch document
  const { data: document, error: docError } = await supabase
    .from("documents").select("*").eq("id", documentId).eq("user_id", userId).maybeSingle();

  if (docError || !document) {
    console.error("Document access error:", docError?.message || "Not found");
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  const fileName = document.file_name.toLowerCase();
  const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
  const fileType = isWordDoc ? "word" : "pdf";

  // Get user plan
  const { data: userProfile } = await supabase
    .from("profiles").select("subscription_plan").eq("user_id", userId).single();

  const userPlan = userProfile?.subscription_plan || "free";
  const maxTtsChars = PLAN_TTS_LIMITS[userPlan] || PLAN_TTS_LIMITS["free"];
  const maxChunks = userPlan === "pro" ? 8 : (userPlan === "plus" ? 3 : 1);
  console.log(`Plan: ${userPlan}, Max TTS: ${maxTtsChars}, elapsed: ${Date.now() - startTime}ms`);

  // Download file
  const { data: fileData, error: downloadError } = await supabase
    .storage.from("talkpdf").download(document.file_url);

  if (downloadError || !fileData) {
    console.error("Failed to download file:", downloadError);
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  const fileArrayBuffer = await fileData.arrayBuffer();
  
  // Check file size to prevent memory crashes
  if (fileArrayBuffer.byteLength > MAX_FILE_SIZE) {
    console.error(`File too large: ${fileArrayBuffer.byteLength} bytes (max ${MAX_FILE_SIZE})`);
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  const fileBase64 = blobToBase64Safe(fileArrayBuffer);
  console.log(`File encoded: ${fileBase64.length} chars, elapsed: ${Date.now() - startTime}ms`);

  // =========================================================================
  // STEP 1: Extract text (required for everything)
  // =========================================================================
  console.log("Extracting text...");
  const extractResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Extract ALL text from the document EXACTLY as written. DO NOT invent content. If unreadable, use [UNREADABLE]. Output ONLY extracted text.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all text content from this document." },
            { type: "file", file: { filename: document.file_name, file_data: `data:application/pdf;base64,${fileBase64}` } }
          ]
        }
      ],
      max_tokens: 16000,
      temperature: 0.1
    })
  });

  if (!extractResponse.ok) {
    const errText = await extractResponse.text();
    console.error("Text extraction failed:", extractResponse.status, errText.substring(0, 200));
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  const extractData = await extractResponse.json();
  const extractedText = extractData.choices?.[0]?.message?.content || "";
  console.log(`Text extracted: ${extractedText.length} chars, elapsed: ${Date.now() - startTime}ms`);

  if (!extractedText || extractedText.length < 50) {
    console.error("Insufficient text extracted");
    await supabase.from("documents").update({ status: "error" }).eq("id", documentId);
    return;
  }

  // =========================================================================
  // STEP 2: Summary + Page Boundaries IN PARALLEL (save ~15s)
  // Free users: summary only. Plus/Pro: summary + page boundaries simultaneously.
  // =========================================================================
  const analysisTextLimit = userPlan === "pro" ? 12000 : (userPlan === "plus" ? 8000 : 5000);
  const textForAnalysis = extractedText.substring(0, analysisTextLimit);
  const maxPages = userPlan === "pro" ? 50 : (userPlan === "plus" ? 30 : 0);

  console.log(`Starting summary${maxPages > 0 ? " + page boundaries" : ""} (parallel)...`);

  // Summary promise
  const summaryPromise = fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an academic content analyst for Nigerian students. Create a summary and study guide from the document.
CRITICAL: Base ONLY on actual document content. Cover the ENTIRE document.
Output valid JSON (no markdown fences):
{
  "summary": "${userPlan === "pro" ? "800-1200 word" : userPlan === "plus" ? "400-700 word" : "200-350 word"} summary covering the document.",
  "study_prompts": [{"topic": "concept", "prompt": "question"}]
}
Generate ${userPlan === "pro" ? "8-12" : userPlan === "plus" ? "5-8" : "3-5"} study prompts.`
        },
        { role: "user", content: textForAnalysis }
      ],
      max_tokens: userPlan === "pro" ? 4000 : (userPlan === "plus" ? 3000 : 2000),
      temperature: 0.3
    })
  }).then(async (res) => {
    if (!res.ok) return { summary: extractedText.substring(0, 1500), studyPrompts: [] };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || extractedText.substring(0, 1500),
          studyPrompts: Array.isArray(parsed.study_prompts) ? parsed.study_prompts : []
        };
      }
    } catch (e) {
      console.warn("Summary parse error:", e);
    }
    return { summary: content.substring(0, 2000) || extractedText.substring(0, 1500), studyPrompts: [] };
  }).catch((e) => {
    console.warn("Summary generation failed:", e instanceof Error ? e.message : e);
    return { summary: extractedText.substring(0, 1500), studyPrompts: [] };
  });

  // Page boundaries promise (only for Plus/Pro, runs in parallel with summary)
  const pageBoundaryPromise = maxPages > 0 && extractedText.length >= 50
    ? fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Identify page boundaries in a PDF. For each page provide:
- page: page number (1-indexed)
- start: first 6-8 words on that page (exact)
- chapter: chapter title if one starts (or null)
Output JSON array only, no fences. Max ${maxPages} pages.`
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Identify page boundaries." },
                { type: "file", file: { filename: document.file_name, file_data: `data:application/pdf;base64,${fileBase64}` } }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      }).then(async (res) => {
        if (!res.ok) return [];
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        try {
          const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]) as Array<{ page: number; start: string; chapter?: string | null }>;
        } catch (e) { console.warn("Page boundary parse error:", e); }
        return [];
      }).catch(() => [])
    : Promise.resolve([]);

  // Wait for both in parallel
  const [{ summary, studyPrompts }, boundaries] = await Promise.all([summaryPromise, pageBoundaryPromise]);
  console.log(`Summary: ${summary.length} chars, ${studyPrompts.length} prompts, ${boundaries.length} boundaries, elapsed: ${Date.now() - startTime}ms`);

  // Split text into pages using boundaries
  let pageContents: Array<{ page: number; text: string; chapter?: string }> = [];
  if (boundaries.length > 0) {
    for (let i = 0; i < boundaries.length && i < maxPages; i++) {
      const boundary = boundaries[i];
      const nextBoundary = boundaries[i + 1];
      const startMarker = boundary.start?.trim();
      let startIdx = 0;
      if (startMarker && i > 0) {
        const prevEnd = pageContents.length > 0
          ? extractedText.indexOf(pageContents[pageContents.length - 1].text) + pageContents[pageContents.length - 1].text.length - 50
          : 0;
        const foundIdx = extractedText.indexOf(startMarker, Math.max(0, prevEnd));
        if (foundIdx >= 0) startIdx = foundIdx;
      }
      let endIdx = extractedText.length;
      if (nextBoundary?.start) {
        const foundEnd = extractedText.indexOf(nextBoundary.start.trim(), startIdx + 10);
        if (foundEnd >= 0) endIdx = foundEnd;
      }
      const pageText = extractedText.substring(startIdx, endIdx).trim();
      if (pageText.length > 10) {
        pageContents.push({ page: boundary.page || (i + 1), text: pageText, chapter: boundary.chapter || undefined });
      }
    }
    // Fallback: even split
    if (pageContents.length === 0) {
      const chunkSize = Math.ceil(extractedText.length / boundaries.length);
      for (let i = 0; i < boundaries.length && i < maxPages; i++) {
        const pageText = extractedText.substring(i * chunkSize, Math.min((i + 1) * chunkSize, extractedText.length)).trim();
        if (pageText.length > 10) {
          pageContents.push({ page: boundaries[i].page || (i + 1), text: pageText, chapter: boundaries[i].chapter || undefined });
        }
      }
    }
  }

  // =========================================================================
  // STEP 3: TTS Audio Generation
  // =========================================================================
  console.log(`Starting TTS, elapsed: ${Date.now() - startTime}ms`);

  let ttsText = summary.trim();
  let translationApplied = false;

  // Translate if needed (use shorter timeout for translation)
  if (language !== "en") {
    try {
      const targetLabel = languageLabelMap[language] || "English";
      const translateResponse = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",  // Use lite model for translation (faster)
          messages: [
            { role: "system", content: `Translate to ${targetLabel}. Output ONLY the translation.` },
            { role: "user", content: ttsText.substring(0, maxTtsChars) }
          ],
          max_tokens: Math.ceil(maxTtsChars / 2),
          temperature: 0.3
        })
      }, 15_000); // 15s timeout for translation
      if (translateResponse.ok) {
        const translateData = await translateResponse.json();
        const translated = (translateData.choices?.[0]?.message?.content || "").trim();
        if (translated && translated.length > 20) {
          ttsText = translated;
          translationApplied = true;
        }
      }
    } catch (e) {
      console.warn("Translation skipped (timeout/error):", e instanceof Error ? e.message : e);
    }
  }

  ttsText = ttsText.replace(/\s+/g, " ").trim().substring(0, maxTtsChars);
  console.log(`TTS text: ${ttsText.length} chars, translation: ${translationApplied}`);

  const YARNGPT_API_KEY = Deno.env.get("YARNGPT_API_KEY");
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

  let audioBuffer: ArrayBuffer | null = null;
  let ttsProvider = "none";
  let voiceUsed = "";
  let chunksGenerated = 0;
  const failedProviders: string[] = [];
  const isNigerianLanguage = ["yo", "ha", "ig", "pcm"].includes(language.toLowerCase());

  // TRY 1: YarnGPT (with timeout)
  if (YARNGPT_API_KEY) {
    const result = await generateYarngptAudio(ttsText, language, YARNGPT_API_KEY, maxChunks);
    if (result.buffer && result.buffer.byteLength > 1024) {
      audioBuffer = result.buffer;
      ttsProvider = "yarngpt";
      voiceUsed = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
      chunksGenerated = result.chunksGenerated;
    } else {
      failedProviders.push(`yarngpt (${result.error || "failed"})`);
    }
  }

  // TRY 2: Gemini TTS
  if (!audioBuffer) {
    const geminiAudio = await generateGeminiTTSAudio(ttsText, language);
    if (geminiAudio && geminiAudio.byteLength > 1024) {
      audioBuffer = geminiAudio;
      ttsProvider = "gemini";
      voiceUsed = geminiVoiceMap[language] || geminiVoiceMap["en"];
      chunksGenerated = 1;
    } else {
      failedProviders.push("gemini");
    }
  }

  // TRY 3: ElevenLabs (English only)
  if (!audioBuffer && ELEVENLABS_API_KEY && !isNigerianLanguage) {
    try {
      const elevenVoice = elevenLabsVoiceMap["en"];
      const response = await fetchWithTimeout(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: ttsText.substring(0, 5000),
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        },
        20_000 // 20s timeout for ElevenLabs
      );
      if (response.ok) {
        const buf = await response.arrayBuffer();
        if (buf.byteLength > 1024) {
          audioBuffer = buf;
          ttsProvider = "elevenlabs";
          voiceUsed = elevenVoice;
          chunksGenerated = 1;
        } else {
          failedProviders.push("elevenlabs (too small)");
        }
      } else {
        failedProviders.push(`elevenlabs (${response.status})`);
      }
    } catch (e) {
      failedProviders.push("elevenlabs (timeout/error)");
    }
  }

  console.log(`TTS done: provider=${ttsProvider}, elapsed: ${Date.now() - startTime}ms`);

  // Upload audio
  let audioPath: string | null = null;
  let audioDurationSeconds = 0;

  if (audioBuffer && audioBuffer.byteLength > 1024) {
    const contentType = ttsProvider === "gemini" ? "audio/wav" : "audio/mpeg";
    const fileExt = ttsProvider === "gemini" ? "wav" : "mp3";
    const audioBlob = new Blob([audioBuffer], { type: contentType });
    audioDurationSeconds = Math.round(ttsText.split(/\s+/).length / 2.5);
    audioPath = `${document.user_id}/${documentId}/audio.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("talkpdf").upload(audioPath, audioBlob, { contentType, upsert: true });

    if (uploadError) {
      console.warn("Audio upload failed:", uploadError);
      audioPath = null;
    }
  } else {
    console.warn(`No audio generated. Failed: ${failedProviders.join(", ")}`);
  }

  const ttsMetadata: TTSMetadata = {
    tts_provider: ttsProvider, requested_language: language,
    translation_applied: translationApplied, failed_providers: failedProviders,
    tts_text_length: ttsText.length, tts_text_preview: ttsText.substring(0, 100),
    audio_size_bytes: audioBuffer?.byteLength || 0, chunks_generated: chunksGenerated,
    processed_at: new Date().toISOString(), voice_used: voiceUsed, file_type: fileType
  };

  // Save all results
  await supabase.from("documents").update({
    status: "ready", summary, study_prompts: studyPrompts,
    page_contents: pageContents.length > 0 ? pageContents : [],
    page_count: pageContents.length > 0 ? pageContents.length : null,
    audio_url: audioPath, audio_duration_seconds: audioDurationSeconds,
    audio_language: language, tts_metadata: ttsMetadata
  }).eq("id", documentId);

  // Track usage (non-blocking)
  const trackUsage = async () => {
    const { data: existingUpload } = await supabase.from("usage_tracking").select("id")
      .eq("user_id", document.user_id).eq("action_type", "pdf_upload")
      .contains("metadata", { document_id: documentId }).maybeSingle();
    if (!existingUpload) {
      await supabase.from("usage_tracking").insert({
        user_id: document.user_id, action_type: "pdf_upload",
        metadata: { document_id: documentId, file_type: fileType }
      });
    }
    if (audioBuffer && audioDurationSeconds > 0) {
      const { data: existingAudio } = await supabase.from("usage_tracking").select("id")
        .eq("user_id", document.user_id).eq("action_type", "audio_conversion")
        .contains("metadata", { document_id: documentId }).maybeSingle();
      if (!existingAudio) {
        await supabase.from("usage_tracking").insert({
          user_id: document.user_id, action_type: "audio_conversion",
          audio_minutes_used: audioDurationSeconds / 60,
          metadata: { document_id: documentId, tts_provider: ttsProvider }
        });
      }
    }
  };
  trackUsage().catch(e => console.warn("Usage tracking error:", e));

  const totalTime = Date.now() - startTime;
  console.log(`✅ Processing complete: ${documentId}, audio: ${audioPath ? "YES" : "NO"}, pages: ${pageContents.length}, total: ${totalTime}ms`);
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

// YarnGPT with per-chunk timeout
async function generateYarngptAudio(
  text: string, language: string, apiKey: string, maxChunks = 1
): Promise<{ buffer: ArrayBuffer | null; chunksGenerated: number; error?: string }> {
  const voice = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
  const chunks = splitIntoChunks(text, 2000);
  const chunksToProcess = chunks.slice(0, maxChunks);
  const audioBuffers: ArrayBuffer[] = [];

  for (let i = 0; i < chunksToProcess.length; i++) {
    const chunk = chunksToProcess[i];
    try {
      const response = await fetchWithTimeout("https://yarngpt.ai/api/v1/tts", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: chunk, voice, response_format: "mp3" })
      }, 20_000); // 20s per chunk

      if (!response.ok) {
        return { buffer: null, chunksGenerated: i, error: `Status ${response.status}` };
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1024) {
          audioBuffers.push(buffer);
        } else {
          return { buffer: null, chunksGenerated: i, error: "Audio too small" };
        }
      } else {
        return { buffer: null, chunksGenerated: i, error: `Unexpected content-type: ${contentType}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Network error";
      return { buffer: null, chunksGenerated: i, error: msg.includes("abort") ? "Timeout" : msg };
    }
  }

  if (audioBuffers.length === 0) return { buffer: null, chunksGenerated: 0, error: "No audio" };
  return { buffer: concatenateAudioBuffers(audioBuffers), chunksGenerated: audioBuffers.length };
}

// WAV header for Gemini PCM output
function addWavHeader(pcmBuffer: ArrayBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): ArrayBuffer {
  const pcmData = new Uint8Array(pcmBuffer);
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  const bytesPerSample = bitsPerSample / 8;
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666D7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  const result = new Uint8Array(44 + pcmData.length);
  result.set(new Uint8Array(wavHeader), 0);
  result.set(pcmData, 44);
  return result.buffer;
}

// Gemini TTS with timeout
async function generateGeminiTTSAudio(text: string, language = "en"): Promise<ArrayBuffer | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return null;

  const voice = geminiVoiceMap[language] || geminiVoiceMap["en"];
  const ttsText = text.substring(0, 5000);

  try {
    console.log(`Gemini TTS: voice=${voice}, text=${ttsText.length} chars`);
    const response = await fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: ttsText }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
          }
        })
      },
      25_000
    );

    if (!response.ok) {
      console.error(`Gemini TTS error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) return null;

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return addWavHeader(bytes.buffer, 24000, 1, 16);
  } catch (e) {
    console.error("Gemini TTS error:", e instanceof Error ? e.message : e);
    return null;
  }
}

// =========================================================================
// Main handler
// =========================================================================
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
      return new Response(JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = userData.user.id;
    const rateLimit = checkRateLimit(userId, "process-pdf", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetIn, corsHeaders);

    const { documentId, language = "en" }: ProcessRequest = await req.json();
    console.log("Processing:", documentId, "Lang:", language, "User:", userId);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: document, error: docError } = await supabase
      .from("documents").select("id, user_id, file_name, file_url")
      .eq("id", documentId).eq("user_id", userId).maybeSingle();

    if (docError || !document) {
      return new Response(JSON.stringify({ error: "Unable to access document" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("documents").update({ status: "processing", audio_language: language }).eq("id", documentId);

    EdgeRuntime.waitUntil(
      processDocumentInBackground(documentId, userId, language, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY || "")
        .catch((error) => {
          console.error("Background failed:", error);
          createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            .from("documents").update({ status: "error" }).eq("id", documentId);
        })
    );

    return new Response(
      JSON.stringify({ success: true, documentId, status: "processing", message: "Document processing started." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Process error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your document" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
