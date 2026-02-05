import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
const geminiVoiceMap: Record<string, string> = {
  "en": "Charon",   // Informative - good for educational content
  "yo": "Kore",     // Firm - clear pronunciation
  "ha": "Kore",
  "ig": "Kore",
  "pcm": "Puck",    // Upbeat - good for Pidgin
};

// ElevenLabs voice mapping - ONLY for English on Free plan
const elevenLabsVoiceMap: Record<string, string> = {
  en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
};

// Generate audio using YarnGPT API (Primary TTS provider for Nigerian languages)
async function generateYarngptAudio(text: string, language: string): Promise<ArrayBuffer | null> {
  const YARNGPT_API_KEY = Deno.env.get("YARNGPT_API_KEY");
  if (!YARNGPT_API_KEY) {
    console.log("YarnGPT API key not configured");
    return null;
  }

  const voice = yarngptVoiceMap[language.toLowerCase()] || yarngptVoiceMap["en"];
  
  try {
    console.log(`YarnGPT: Generating audio with voice ${voice} for language ${language}...`);
    
    const response = await fetch("https://yarngpt.ai/api/v1/tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${YARNGPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.substring(0, 2000), // YarnGPT limit
        voice: voice,
        response_format: "mp3"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`YarnGPT error: ${response.status}`, errorText.substring(0, 200));
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3") || contentType.includes("octet-stream")) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 1024) {
        console.log(`YarnGPT: Successfully generated audio, size: ${buffer.byteLength} bytes`);
        return buffer;
      }
    }
    
    console.warn("YarnGPT: Invalid response format");
    return null;
  } catch (error) {
    console.error("YarnGPT TTS error:", error instanceof Error ? error.message : String(error));
    return null;
  }
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
    
    // CRITICAL: Add WAV header to make the PCM audio playable in browsers
    const wavBuffer = addWavHeader(bytes.buffer, 24000, 1, 16);
    console.log(`Gemini TTS: Successfully generated WAV audio, size: ${wavBuffer.byteLength} bytes`);
    return wavBuffer;
  } catch (error) {
    console.error("Gemini TTS error:", error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Generate audio using ElevenLabs (Final fallback - English only)
async function generateElevenLabsAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    console.log("ElevenLabs API key not configured");
    return null;
  }

  // Only use ElevenLabs for English
  const voiceId = elevenLabsVoiceMap["en"];
  
  try {
    console.log(`ElevenLabs: Generating audio with voice ${voiceId} for English...`);
    
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
            ${languageInstructions[language as keyof typeof languageInstructions] || languageInstructions["en"]}
            
            CONTENT QUALITY RULES (CRITICAL):
            1. DO NOT invent facts not present in the provided document context
            2. AVOID filler phrases: "So basically...", "You know...", "Let me tell you..."
            3. DO NOT repeat explanations in different words - say it once clearly
            4. Be direct - every sentence should add educational value
            5. Base explanations ONLY on the provided content`,
          },
          {
            role: "user",
            content: `Create a 60-second micro-lesson explaining: "${concept}"
            ${documentSummary ? `\nContext from the document: ${documentSummary.slice(0, 500)}` : ""}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.6,
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

    // Generate TTS audio with fallback chain: YarnGPT -> Gemini -> ElevenLabs (English only)
    let audioBase64: string | null = null;
    let audioProvider = "none";
    
    // Determine if this is a Nigerian language (not English)
    const isNigerianLanguage = ["yo", "ha", "ig", "pcm"].includes(language.toLowerCase());

    // TRY 1: YarnGPT for Nigerian languages (primary)
    const yarngptAudio = await generateYarngptAudio(explanation, language);
    if (yarngptAudio) {
      audioBase64 = base64Encode(yarngptAudio);
      audioProvider = "yarngpt";
      console.log(`Generated audio with YarnGPT for language: ${language}`);
    } else {
      // TRY 2: Gemini TTS (secondary fallback - preferred for Nigerian languages)
      const geminiAudio = await generateGeminiTTSAudio(explanation, language);
      if (geminiAudio) {
        audioBase64 = base64Encode(geminiAudio);
        audioProvider = "gemini";
        console.log("Generated audio with Gemini TTS fallback");
      } else if (!isNigerianLanguage) {
        // TRY 3: ElevenLabs ONLY for English (not for Nigerian languages)
        const elevenAudio = await generateElevenLabsAudio(explanation, "en");
        if (elevenAudio) {
          audioBase64 = base64Encode(elevenAudio);
          audioProvider = "elevenlabs";
          console.log("Generated audio with ElevenLabs fallback (English only)");
        }
      } else {
        console.log("Skipping ElevenLabs for Nigerian language - no native support");
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
