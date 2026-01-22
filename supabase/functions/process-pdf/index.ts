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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;
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

    // Update status to processing
    await supabase
      .from("documents")
      .update({ status: "processing", audio_language: language })
      .eq("id", documentId);

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("talkpdf")
      .download(document.file_url);

    if (downloadError || !fileData) {
      console.error("Failed to download PDF:", downloadError);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to download PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract text from PDF using AI
    const pdfBase64 = await blobToBase64(fileData);
    
    console.log("Extracting text from PDF...");
    
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: "You are a document extraction assistant. Extract ALL text content from the provided PDF document. Preserve the structure and order of the content. Focus on extracting educational content, key concepts, and important information that students would need to learn. Output only the extracted text, no commentary."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this PDF document. Include all educational content, definitions, concepts, and key points."
              },
              {
                type: "file",
                file: {
                  filename: document.file_name,
                  file_data: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 16000
      })
    });

    if (!extractResponse.ok) {
      const errorText = await extractResponse.text();
      console.error("AI extraction failed:", errorText);
      await supabase
        .from("documents")
        .update({ status: "error" })
        .eq("id", documentId);
      return new Response(
        JSON.stringify({ error: "Failed to extract text from PDF" }),
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
        JSON.stringify({ error: "Could not extract text from PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate summary and study prompts
    console.log("Generating summary and study prompts...");
    
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
            content: `You are an educational content analyzer. Create a comprehensive summary and study prompts from the document content. 
            
Output a JSON object with this structure:
{
  "summary": "A comprehensive summary of the document (300-500 words)",
  "key_concepts": ["concept1", "concept2", ...],
  "study_prompts": [
    {"topic": "Topic name", "prompt": "Explain..."},
    ...
  ]
}

Create 3-5 study prompts that will help students test their understanding.`
          },
          {
            role: "user",
            content: `Analyze this document content and create a summary with study prompts:\n\n${extractedText.substring(0, 10000)}`
          }
        ],
        max_tokens: 4000
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

    // Generate audio using TTS - try Spitch first, fallback to ElevenLabs
    console.log("Generating audio with TTS...");
    
    let audioPath: string | null = null;
    let audioDurationSeconds = 0;
    
    // Build a short, spoken-friendly script (keeps ElevenLabs within quota)
    // - Use the generated summary (already compact)
    // - Translate it to the requested language for better language sync
    let ttsText = (summary || extractedText.substring(0, 1000)).trim();

    if (language !== "en" && LOVABLE_API_KEY) {
      try {
        console.log(`Translating TTS script to ${language}...`);
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
                content:
                  "You translate text for spoken audio. Output ONLY the translation (no quotes, no extra notes). Keep it natural and easy to listen to.",
              },
              {
                role: "user",
                content: `Translate this into ${targetLabel}. Keep it under 1200 characters.\n\n${ttsText}`,
              },
            ],
            max_tokens: 1200,
          }),
        });

        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          const translated = (translateData.choices?.[0]?.message?.content || "").trim();
          if (translated) ttsText = translated;
        } else {
          const errorText = await translateResponse.text();
          console.warn("Translation failed, falling back to English summary:", errorText);
        }
      } catch (e) {
        console.warn("Translation error, falling back to English summary:", e);
      }
    }

    // Hard cap to avoid provider quota/limits
    ttsText = ttsText.replace(/\s+/g, " ").trim();
    const MAX_TTS_CHARS = 1400;
    if (ttsText.length > MAX_TTS_CHARS) {
      ttsText = ttsText.substring(0, MAX_TTS_CHARS);
    }
    
    // Map language to Spitch voices
    const spitchVoiceMap: Record<string, string> = {
      "en": "lucy",
      "yo": "sade",
      "ha": "zainab",
      "ig": "ngozi",
      "pcm": "lucy"
    };
    
    // Map language to ElevenLabs voice (fallback)
    const elevenLabsVoiceMap: Record<string, string> = {
      "en": "EXAVITQu4vr4xnSDxMaL", // Sarah
      "yo": "EXAVITQu4vr4xnSDxMaL",
      "ha": "EXAVITQu4vr4xnSDxMaL",
      "ig": "EXAVITQu4vr4xnSDxMaL",
      "pcm": "EXAVITQu4vr4xnSDxMaL"
    };
    
    const selectedVoice = spitchVoiceMap[language] || spitchVoiceMap["en"];
    const SPITCH_API_KEY = Deno.env.get("SPITCH_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    let audioBuffer: ArrayBuffer | null = null;
    let ttsProvider = "none";

    // Map language to Spitch API language enum (yo, en, ha, ig, am)
    const spitchLanguageMap: Record<string, string> = {
      yo: "yo", yoruba: "yo",
      ha: "ha", hausa: "ha",
      ig: "ig", igbo: "ig",
      pcm: "en", pidgin: "en",
      en: "en", english: "en",
      am: "am", amharic: "am",
    };
    const spitchLanguage = spitchLanguageMap[language.toLowerCase()] || "en";

    // Try Spitch first (Nigerian language TTS) - using correct endpoint
    try {
      if (SPITCH_API_KEY) {
        console.log(`Attempting Spitch TTS with language: ${spitchLanguage}, voice: ${selectedVoice}...`);
        
        // Use the correct Spitch API endpoint per their documentation
        const ttsResponse = await fetch("https://api.spitch.app/v1/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SPITCH_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language: spitchLanguage,
            text: ttsText.substring(0, 5000), // Spitch has text limits
            voice: selectedVoice,
            format: "mp3",
          }),
        });

        if (ttsResponse.ok) {
          audioBuffer = await ttsResponse.arrayBuffer();
          ttsProvider = "spitch";
          console.log("Spitch TTS successful");
        } else {
          const errorText = await ttsResponse.text();
          console.warn("Spitch TTS failed:", ttsResponse.status, errorText.substring(0, 200));
        }
      }
    } catch (spitchError) {
      console.warn("Spitch TTS error:", spitchError instanceof Error ? spitchError.message : String(spitchError));
    }

    // Fallback to ElevenLabs if Spitch failed
    if (!audioBuffer && ELEVENLABS_API_KEY) {
      try {
        console.log("Falling back to ElevenLabs TTS...");
        const elevenVoice = elevenLabsVoiceMap[language] || elevenLabsVoiceMap["en"];

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
          // Clone response before reading body to avoid "Body already consumed" error
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
          console.log("ElevenLabs TTS successful");
        } else {
          // Clone response before reading body
          const errorText = await ttsResponse.clone().text();
          console.warn("ElevenLabs TTS failed:", errorText);
        }
      } catch (elevenLabsError) {
        console.warn("ElevenLabs TTS error:", elevenLabsError);
      }
    }

    // Upload audio if we got any
    if (audioBuffer) {
      try {
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
        
        // Calculate approximate audio duration (~150 words per minute)
        const wordCount = ttsText.split(/\s+/).length;
        audioDurationSeconds = Math.round(wordCount / 2.5);

        // Upload audio to storage
        audioPath = `${document.user_id}/${documentId}/audio.mp3`;
        
        const { error: uploadError } = await supabase
          .storage
          .from("talkpdf")
          .upload(audioPath, audioBlob, {
            contentType: "audio/mpeg",
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

    // Update document with all the generated content (audio may be null if TTS failed)
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        summary: summary,
        study_prompts: studyPrompts,
        audio_url: audioPath,
        audio_duration_seconds: audioDurationSeconds,
        audio_language: language
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Failed to update document:", updateError);
    }

    // Track usage (idempotent):
    // - pdf_upload should only be counted once per document
    // - audio_conversion only when audio was actually generated
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
        metadata: { document_id: documentId }
      });
    }

    if (audioPath && audioDurationSeconds > 0) {
      await supabase.from("usage_tracking").insert({
        user_id: document.user_id,
        action_type: "audio_conversion",
        audio_minutes_used: audioDurationSeconds / 60,
        metadata: { document_id: documentId, language }
      });
    }

    // Sync daily usage summary from usage_tracking (prevents drift/double-counting)
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfToday.getUTCDate() + 1);
    const today = startOfToday.toISOString().split("T")[0];

    const { data: todayUsageRows, error: todayUsageError } = await supabase
      .from("usage_tracking")
      .select("action_type, audio_minutes_used")
      .eq("user_id", document.user_id)
      .gte("created_at", startOfToday.toISOString())
      .lt("created_at", startOfTomorrow.toISOString());

    if (todayUsageError) {
      console.warn("Failed to fetch usage rows for daily summary sync:", todayUsageError);
    } else {
      const rows = todayUsageRows || [];
      const pdfs_uploaded = rows.filter((r) => r.action_type === "pdf_upload").length;
      const explain_back_count = rows.filter((r) => r.action_type === "explain_back").length;
      const audio_minutes_used = rows
        .filter((r) => r.action_type === "audio_conversion")
        .reduce((acc, r) => acc + Number(r.audio_minutes_used || 0), 0);

      await supabase
        .from("daily_usage_summary")
        .upsert(
          {
            user_id: document.user_id,
            date: today,
            pdfs_uploaded,
            audio_minutes_used,
            explain_back_count,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,date" }
        );
    }

    console.log("Document processed successfully:", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary: summary.substring(0, 200) + "...",
        studyPromptsCount: studyPrompts.length,
        audioDuration: audioDurationSeconds
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
