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
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
            The explanation should take about 60 seconds when read aloud at normal pace.
            ${language === "pcm" ? "Use Nigerian Pidgin English for the explanation." : ""}
            ${language === "yo" ? "Include some Yoruba phrases where natural." : ""}
            ${language === "ig" ? "Include some Igbo phrases where natural." : ""}
            ${language === "ha" ? "Include some Hausa phrases where natural." : ""}`,
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
      throw new Error("Failed to generate explanation");
    }

    const aiData = await aiResponse.json();
    const explanation = aiData.choices?.[0]?.message?.content || "";

    // Generate quiz question for the concept
    const quizResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
