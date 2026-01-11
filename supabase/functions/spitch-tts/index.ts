import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Spitch voice mapping for Nigerian languages
const voiceMap: Record<string, string> = {
  // Yoruba voices
  yo: "sade",       // Feminine, energetic
  yoruba: "sade",
  // Hausa voices  
  ha: "zainab",     // Feminine, clear
  hausa: "zainab",
  // Igbo voices
  ig: "ngozi",      // Feminine, soft
  igbo: "ngozi",
  // Nigerian Pidgin (use English voice)
  pcm: "lucy",
  pidgin: "lucy",
  // English voices
  en: "lucy",       // Feminine, very clear
  english: "lucy",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    console.log("Generating Spitch TTS for user:", userId);

    const { text, language = "en", voiceId } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SPITCH_API_KEY = Deno.env.get("SPITCH_API_KEY");
    if (!SPITCH_API_KEY) {
      console.error("SPITCH_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "TTS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the appropriate voice for the language
    const selectedVoice = voiceId || voiceMap[language.toLowerCase()] || voiceMap["en"];
    
    console.log(`Generating TTS with Spitch - language: ${language}, voice: ${selectedVoice}, text length: ${text.length}`);

    // Call Spitch TTS API
    const response = await fetch("https://api.spitch.app/api/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SPITCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.substring(0, 5000), // Spitch has text limits
        voice: selectedVoice,
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Spitch API error:", response.status, errorText);
      
      // Return specific error for better debugging
      return new Response(
        JSON.stringify({ 
          error: `Spitch TTS failed: ${response.status}`,
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the audio as arraybuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Encode to base64 for JSON response
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, [...chunk]);
    }
    const base64Audio = btoa(binary);

    console.log(`Spitch TTS generated: ${base64Audio.length} bytes (base64) for user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        format: "mp3",
        language,
        voice: selectedVoice
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in spitch-tts:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate audio" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
