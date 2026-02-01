import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// YarnGPT voice mapping for Nigerian languages
const YARNGPT_VOICES: Record<string, string> = {
  "en": "idera",      // Nigerian-accented English
  "yo": "yoruba_female2",
  "ig": "igbo_female2",
  "ha": "hausa_female1",
  "pcm": "tayo",      // Nigerian Pidgin
};

async function generateYarnGPTAudio(text: string, language: string): Promise<ArrayBuffer | null> {
  const YARNGPT_API_KEY = Deno.env.get("YARNGPT_API_KEY");
  if (!YARNGPT_API_KEY) {
    console.log("YarnGPT API key not configured");
    return null;
  }

  const voice = YARNGPT_VOICES[language] || YARNGPT_VOICES["en"];
  
  try {
    // Chunk text if over 2000 chars
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 2000) {
        chunks.push(remaining);
        break;
      }
      
      // Find last sentence end within limit
      let splitPoint = remaining.lastIndexOf('. ', 1900);
      if (splitPoint === -1) splitPoint = remaining.lastIndexOf(' ', 1900);
      if (splitPoint === -1) splitPoint = 1900;
      
      chunks.push(remaining.substring(0, splitPoint + 1));
      remaining = remaining.substring(splitPoint + 1).trim();
    }

    const audioBuffers: ArrayBuffer[] = [];
    
    for (const chunk of chunks) {
      const response = await fetch("https://api.yarngpt.com/v1/text-to-speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${YARNGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: chunk,
          voice: voice,
          output_format: "mp3",
        }),
      });

      if (!response.ok) {
        console.error(`YarnGPT error: ${response.status}`);
        return null;
      }

      const audioData = await response.arrayBuffer();
      audioBuffers.push(audioData);
    }

    // Concatenate audio buffers
    if (audioBuffers.length === 1) {
      return audioBuffers[0];
    }

    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioBuffers) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    
    return combined.buffer;
  } catch (error) {
    console.error("YarnGPT TTS error:", error);
    return null;
  }
}

async function generateElevenLabsAudio(text: string, language: string = "en"): Promise<ArrayBuffer | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    console.log("ElevenLabs API key not configured");
    return null;
  }

  // Voice mapping for Nigerian languages with authentic accents
  const voiceMap: Record<string, string> = {
    en: "onwK4e9ZLuTAKqWW03F9",  // Daniel - Nigerian accent
    yo: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
    ha: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
    ig: "9Dbo4hEvXQ5l7MXGZFQA",  // Olufunmilola - African Female Nigerian Accent
    pcm: "onwK4e9ZLuTAKqWW03F9", // Daniel - Nigerian accent for Pidgin
  };

  try {
    const voiceId = voiceMap[language] || voiceMap["en"];
    
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
      console.error(`ElevenLabs error: ${response.status}`);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
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

    // Generate TTS audio with Nigerian accent
    let audioBase64: string | null = null;
    let audioProvider = "none";

    // Try YarnGPT first for Nigerian accent
    const yarnAudio = await generateYarnGPTAudio(explanation, language);
    if (yarnAudio) {
      audioBase64 = base64Encode(yarnAudio);
      audioProvider = "yarngpt";
      console.log(`Generated audio with YarnGPT for language: ${language}`);
    } else {
    // Fallback to ElevenLabs with language-specific voice
      const elevenAudio = await generateElevenLabsAudio(explanation, language);
      if (elevenAudio) {
        audioBase64 = base64Encode(elevenAudio);
        audioProvider = "elevenlabs";
        console.log("Generated audio with ElevenLabs fallback");
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
