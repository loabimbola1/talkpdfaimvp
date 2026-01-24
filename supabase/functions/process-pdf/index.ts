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

// YarnGPT voice mapping for Nigerian languages
// Valid YarnGPT voices: "idera" (default), "chinenye", "zainab", "tayo"
// Note: "emma" is NOT a valid voice - use "idera" for English with Nigerian accent
const yarnGPTVoiceMap: Record<string, string> = {
  "en": "idera",     // Nigerian accent for English (default/best voice)
  "yo": "idera",     // Melodic, gentle (Yoruba native)
  "ha": "zainab",    // Soothing, gentle (Hausa native)
  "ig": "chinenye",  // Engaging, warm (Igbo native)
  "pcm": "tayo",     // Upbeat, energetic (good for Pidgin)
};

// ElevenLabs voice mapping for Nigerian-sounding voices
// Using voices with African/Nigerian accents where possible
const elevenLabsVoiceMap: Record<string, string> = {
  "en": "pFZP5JQG7iQjIQuC4Bku",  // Lily - clear, warm (better than British Sarah)
  "yo": "onwK4e9ZLuTAKqWW03F9",  // Daniel - warm, expressive
  "ha": "TX3LPaxmHKxFdv7VOQHJ",  // Liam - warm, engaging
  "ig": "cjVigY5qzO86Huf0OWal",  // Eric - clear, friendly
  "pcm": "bIHbv24MWmeRgasZH58o", // Will - friendly, conversational
};

// Plan-based TTS character limits
const PLAN_TTS_LIMITS: Record<string, number> = {
  "free": 1400,    // Short summary only
  "plus": 5000,    // Extended summary (~10 min audio)
  "pro": 15000,    // Comprehensive (~25 min audio)
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

    // Get user's subscription plan for TTS limits
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("user_id", userId)
      .single();
    
    const userPlan = userProfile?.subscription_plan || "free";
    const maxTtsChars = PLAN_TTS_LIMITS[userPlan] || PLAN_TTS_LIMITS["free"];
    
    console.log(`User plan: ${userPlan}, Max TTS chars: ${maxTtsChars}`);

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

    // Generate audio using TTS - try multiple providers with improved fallback
    console.log("Generating audio with TTS...");
    
    let audioPath: string | null = null;
    let audioDurationSeconds = 0;
    
    // Build TTS script based on user's plan
    // Free: Use summary only
    // Plus: Use extended summary
    // Pro: Use comprehensive summary (almost page-by-page)
    let ttsText = summary.trim();

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
          if (translated) ttsText = translated;
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
    
    const YARNGPT_API_KEY = Deno.env.get("YARNGPT_API_KEY");
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    let audioBuffer: ArrayBuffer | null = null;
    let ttsProvider = "none";
    const failedProviders: string[] = [];

    // Try YarnGPT first for ALL Nigerian languages (best for Nigerian accents)
    if (YARNGPT_API_KEY) {
      try {
        const selectedVoice = yarnGPTVoiceMap[language.toLowerCase()] || yarnGPTVoiceMap["en"];
        console.log(`Attempting YarnGPT TTS with voice: ${selectedVoice} for language: ${language}...`);
        
        // YarnGPT has 2000 char limit per request
        const yarnText = ttsText.substring(0, 2000);
        
        const ttsResponse = await fetch("https://yarngpt.ai/api/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${YARNGPT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: yarnText,
            voice: selectedVoice,
            response_format: "mp3"
          }),
        });

        if (ttsResponse.ok) {
          const contentType = ttsResponse.headers.get("content-type") || "";
          console.log(`YarnGPT response content-type: ${contentType}`);
          
          if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
            audioBuffer = await ttsResponse.arrayBuffer();
            
            // Validate we got actual audio data (at least 1KB)
            if (audioBuffer.byteLength > 1024) {
              ttsProvider = "yarngpt";
              console.log(`YarnGPT TTS successful for ${language}, audio size:`, audioBuffer.byteLength);
            } else {
              console.warn("YarnGPT returned too small audio buffer:", audioBuffer.byteLength);
              audioBuffer = null;
              failedProviders.push("yarngpt (audio too small)");
            }
          } else {
            // Response might be JSON with error
            const responseText = await ttsResponse.text();
            console.warn("YarnGPT TTS unexpected response type:", contentType, responseText.substring(0, 200));
            failedProviders.push("yarngpt (unexpected response)");
          }
        } else {
          const errorText = await ttsResponse.text();
          console.warn("YarnGPT TTS failed:", ttsResponse.status, errorText.substring(0, 300));
          failedProviders.push(`yarngpt (${ttsResponse.status})`);
        }
      } catch (yarnError) {
        console.warn("YarnGPT TTS error:", yarnError instanceof Error ? yarnError.message : String(yarnError));
        failedProviders.push(`yarngpt (${yarnError instanceof Error ? yarnError.message : 'error'})`);
      }
    } else {
      console.log("YarnGPT API key not configured, skipping");
      failedProviders.push("yarngpt (no API key)");
    }

    // Fallback to ElevenLabs with Nigerian-appropriate voices
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

    // Fallback to OpenRouter TTS using Gemini 2.5 Flash (supports native TTS)
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!audioBuffer && OPENROUTER_API_KEY) {
      try {
        console.log("Falling back to OpenRouter Gemini TTS...");
        
        // Use Gemini 2.5 Flash Preview TTS with proper audio output configuration
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://talkpdfaimvp.lovable.app",
            "X-Title": "TalkPDF AI"
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-preview-tts",
            messages: [
              {
                role: "user",
                content: `Read this text naturally as an audiobook narrator: ${ttsText.substring(0, 8000)}`
              }
            ],
            modalities: ["text", "audio"],
            audio: {
              voice: "Kore",
              format: "mp3"
            }
          }),
        });

        if (openRouterResponse.ok) {
          const responseData = await openRouterResponse.json();
          console.log("OpenRouter response structure:", JSON.stringify(responseData, null, 2).substring(0, 500));
          
          // Check multiple possible locations for audio data
          const audioData = responseData.choices?.[0]?.message?.audio?.data 
            || responseData.choices?.[0]?.message?.content?.audio?.data
            || responseData.audio?.data;
            
          if (audioData) {
            // Decode base64 to ArrayBuffer
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioBuffer = bytes.buffer;
            ttsProvider = "openrouter-gemini";
            console.log("OpenRouter Gemini TTS successful");
          } else {
            console.warn("OpenRouter Gemini TTS: No audio data found in response. Keys:", Object.keys(responseData));
            failedProviders.push("openrouter (no audio data)");
          }
        } else {
          const errorText = await openRouterResponse.text();
          console.warn("OpenRouter Gemini TTS failed:", openRouterResponse.status, errorText.substring(0, 500));
          failedProviders.push(`openrouter (${openRouterResponse.status})`);
        }
      } catch (openRouterError) {
        console.warn("OpenRouter Gemini TTS error:", openRouterError instanceof Error ? openRouterError.message : String(openRouterError));
        failedProviders.push("openrouter (error)");
      }
    }

    // Final fallback: Use Lovable AI Gateway for TTS if available
    if (!audioBuffer && LOVABLE_API_KEY) {
      try {
        console.log("Falling back to Lovable AI Gateway for TTS...");
        
        const lovableTTSResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "Generate audio narration for the following educational content. Speak clearly and at a moderate pace suitable for learning."
              },
              {
                role: "user",
                content: ttsText.substring(0, 5000)
              }
            ],
            modalities: ["audio"],
            audio: {
              voice: "Kore",
              format: "mp3"
            }
          }),
        });

        if (lovableTTSResponse.ok) {
          const responseData = await lovableTTSResponse.json();
          const audioData = responseData.choices?.[0]?.message?.audio?.data;
          
          if (audioData) {
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioBuffer = bytes.buffer;
            ttsProvider = "lovable-gemini";
            console.log("Lovable AI Gateway TTS successful");
          } else {
            failedProviders.push("lovable (no audio data)");
          }
        } else {
          const errorText = await lovableTTSResponse.text();
          console.warn("Lovable AI Gateway TTS failed:", lovableTTSResponse.status, errorText.substring(0, 200));
          failedProviders.push(`lovable (${lovableTTSResponse.status})`);
        }
      } catch (lovableError) {
        console.warn("Lovable AI Gateway TTS error:", lovableError instanceof Error ? lovableError.message : String(lovableError));
        failedProviders.push("lovable (error)");
      }
    }

    // Log failed providers for debugging
    if (failedProviders.length > 0) {
      console.log("Failed TTS providers:", failedProviders.join(", "));
    }

    // Upload audio if we got any
    if (audioBuffer && audioBuffer.byteLength > 1024) {
      try {
        // Determine content type based on provider
        const contentType = "audio/mpeg";
        const fileExt = "mp3";
        
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
        metadata: { document_id: documentId, language, tts_provider: ttsProvider }
      });
    }

    // Sync daily usage summary from usage_tracking
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

    console.log("Document processed successfully:", documentId, "TTS Provider:", ttsProvider, "Plan:", userPlan);

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        summary: summary.substring(0, 200) + "...",
        studyPromptsCount: studyPrompts.length,
        audioDuration: audioDurationSeconds,
        ttsProvider,
        userPlan
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
