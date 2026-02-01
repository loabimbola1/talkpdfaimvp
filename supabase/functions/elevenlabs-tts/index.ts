import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit config: 15 TTS requests per minute per user
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,
  maxRequests: 15,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cleanup old rate limit entries
  cleanupRateLimits();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
    const rateLimit = checkRateLimit(userId, "elevenlabs-tts", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for user ${userId}`);
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    console.log("Generating TTS for user:", userId);

    const { text, language, voiceId } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Voice mapping for Nigerian languages
    // Using authentic Nigerian accent voices from ElevenLabs
    const voiceMapping: Record<string, string> = {
      en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
      yo: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
      ha: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
      ig: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
      pcm: "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
    };

    const selectedVoice = voiceId || voiceMapping[language] || voiceMapping.en;

    console.log(`Generating TTS for language: ${language}, voice: ${selectedVoice}, text length: ${text.length}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}?output_format=mp3_44100_128`,
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    
    // Encode to base64 properly
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, [...chunk]);
    }
    const base64Audio = btoa(binary);

    console.log(`Generated audio: ${base64Audio.length} bytes for user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: "mp3",
        language 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in elevenlabs-tts:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate audio" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
