import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language, voiceId } = await req.json();

    if (!text) {
      throw new Error("Text is required");
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // Voice mapping for Nigerian languages
    // Using ElevenLabs voices that work well for African languages
    const voiceMapping: Record<string, string> = {
      en: "EXAVITQu4vr4xnSDxMaL", // Sarah - Clear English
      yo: "EXAVITQu4vr4xnSDxMaL", // Will use English voice with Yoruba text
      ha: "EXAVITQu4vr4xnSDxMaL", // Hausa
      ig: "EXAVITQu4vr4xnSDxMaL", // Igbo
      pcm: "EXAVITQu4vr4xnSDxMaL", // Nigerian Pidgin
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

    console.log(`Generated audio: ${base64Audio.length} bytes`);

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
