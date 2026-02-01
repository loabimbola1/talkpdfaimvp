import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Spitch voice mapping for Nigerian languages (Primary TTS provider)
const spitchVoiceMap: Record<string, { voice: string; language: string }> = {
  "yo": { voice: "sade", language: "yo" },     // Yoruba
  "ha": { voice: "zainab", language: "ha" },   // Hausa
  "ig": { voice: "ngozi", language: "ig" },    // Igbo
  "en": { voice: "lucy", language: "en" },     // English
  "pcm": { voice: "lucy", language: "en" },    // Pidgin
};

// Gemini TTS voice mapping
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",   // Informative - good for educational content
  "yo": "Kore",     // Firm - clear pronunciation
  "ha": "Kore",
  "ig": "Kore",
  "pcm": "Puck",    // Upbeat - good for Pidgin
};

// ElevenLabs voice mapping for Nigerian-sounding voices
const elevenLabsVoiceMap: Record<string, string> = {
  en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
  yo: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
  ha: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola
  ig: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola
  pcm: "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
};

// Generate audio using Spitch API (Primary TTS provider for Nigerian languages)
async function generateSpitchAudio(text: string, language: string): Promise<ArrayBuffer | null> {
  const SPITCH_API_KEY = Deno.env.get("SPITCH_API_KEY");
  if (!SPITCH_API_KEY) {
    console.log("Spitch API key not configured");
    return null;
  }

  const config = spitchVoiceMap[language.toLowerCase()] || spitchVoiceMap["en"];
  
  try {
    console.log(`Spitch: Generating audio with voice ${config.voice} for language ${language}...`);
    
    const response = await fetch("https://api.spitch.app/v1/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SPITCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.substring(0, 2000), // Spitch limit
        voice: config.voice,
        language: config.language,
        format: "mp3"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Spitch error: ${response.status}`, errorText.substring(0, 200));
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 1024) {
        console.log(`Spitch: Successfully generated audio, size: ${buffer.byteLength} bytes`);
        return buffer;
      }
    }
    
    console.warn("Spitch: Invalid response format");
    return null;
  } catch (error) {
    console.error("Spitch TTS error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Generate audio using Google Gemini TTS (Secondary fallback)
async function generateGeminiTTSAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    console.log("Gemini API key not configured");
    return null;
  }

  const voice = geminiVoiceMap[language] || geminiVoiceMap["en"];
  const ttsText = text.substring(0, 5000);

  try {
    console.log(`Gemini TTS: Generating audio with voice ${voice}...`);
    
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
      console.warn("Gemini TTS: No audio data in response");
      return null;
    }

    // Decode base64 to ArrayBuffer
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

// Generate audio using ElevenLabs (Final fallback)
async function generateElevenLabsAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    console.log("ElevenLabs API key not configured");
    return null;
  }

  const voiceId = elevenLabsVoiceMap[language] || elevenLabsVoiceMap["en"];
  
  try {
    console.log(`ElevenLabs: Generating audio with voice ${voiceId} for language ${language}...`);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.substring(0, 5000), // ElevenLabs limit
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs error: ${response.status}`, errorText.substring(0, 200));
      return null;
    }

    const buffer = await response.arrayBuffer();
    console.log(`ElevenLabs: Successfully generated audio, size: ${buffer.byteLength} bytes`);
    return buffer;
  } catch (error) {
    console.error("ElevenLabs TTS error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { concept, documentSummary, language = "en" } = await req.json();

    if (!concept) {
      return new Response(
        JSON.stringify({ error: "Concept is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Generate AI explanation for the concept
    const languageInstructions = {
      "en": "Use clear English with Nigerian cultural references and examples.",
      "pcm": "Use Nigerian Pidgin English for the explanation. Make it natural and conversational.",
      "yo": "Include Yoruba phrases and proverbs where natural. Primary explanation in English with Yoruba flavor.",
      "ig": "Include Igbo phrases and proverbs where natural. Primary explanation in English with Igbo flavor.",
      "ha": "Include Hausa phrases and proverbs where natural. Primary explanation in English with Hausa flavor.",
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a patient, friendly tutor explaining concepts to Nigerian students. 
            Create a 60-second micro-lesson explanation that:
            1. Starts with a relatable hook or analogy
            2. Explains the core concept simply
            3. Uses local Nigerian examples when possible (e.g., Naija football, local markets, popular culture)
            4. Ends with a memorable summary
            
            Keep it conversational and engaging - like a friendly senior student explaining to a junior.
            The explanation should take about 60 seconds when read aloud at normal pace (approximately 150-180 words).
            ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions["en"]}`,
          },
          {
            role: "user",
            content: `Create a 60-second micro-lesson explaining: "${concept}"
            ${documentSummary ? `\nContext from the document: ${documentSummary.slice(0, 500)}` : ""}`,
          },
        ],
        max_tokens: 400,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Failed to generate explanation");
    }

    const aiData = await aiResponse.json();
    const explanation = aiData.choices?.[0]?.message?.content || "";

    // Generate TTS audio with fallback chain: Spitch -> Gemini -> ElevenLabs
    let audioBase64: string | null = null;
    let audioProvider = "none";

    // TRY 1: Spitch for Nigerian accent (primary)
    const spitchAudio = await generateSpitchAudio(explanation, language);
    if (spitchAudio) {
      audioBase64 = base64Encode(spitchAudio);
      audioProvider = "spitch";
      console.log(`Generated audio with Spitch for language: ${language}`);
    } else {
      // TRY 2: Gemini TTS (secondary fallback)
      const geminiAudio = await generateGeminiTTSAudio(explanation, language);
      if (geminiAudio) {
        audioBase64 = base64Encode(geminiAudio);
        audioProvider = "gemini";
        console.log("Generated audio with Gemini TTS fallback");
      } else {
        // TRY 3: ElevenLabs with language-specific voice (final fallback)
        const elevenAudio = await generateElevenLabsAudio(explanation, language);
        if (elevenAudio) {
          audioBase64 = base64Encode(elevenAudio);
          audioProvider = "elevenlabs";
          console.log("Generated audio with ElevenLabs fallback");
        }
      }
    }

    // Generate quiz question for the concept
    const quizResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Generate a simple comprehension question based on the explanation. Return JSON format: { \"question\": \"...\", \"answer\": \"...\" }",
          },
          {
            role: "user",
            content: `Based on this explanation, create a simple question to check understanding:\n\n${explanation}`,
          },
        ],
        max_tokens: 200,
      }),
    });

    let quiz = null;
    if (quizResponse.ok) {
      const quizData = await quizResponse.json();
      const quizContent = quizData.choices?.[0]?.message?.content || "";
      try {
        // Try to parse JSON from the response
        const jsonMatch = quizContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          quiz = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse quiz:", e);
      }
    }

    return new Response(
      JSON.stringify({
        explanation,
        quiz,
        estimatedDuration: 60,
        audioBase64,
        audioProvider,
        language,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating lesson:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
