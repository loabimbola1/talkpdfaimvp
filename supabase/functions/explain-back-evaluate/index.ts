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
    const { concept, explanation, documentId } = await req.json();

    if (!concept || !explanation) {
      throw new Error("Concept and explanation are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an educational AI evaluator for TalkPDF AI, a learning platform for Nigerian students. Your job is to evaluate how well a student understands a concept based on their explanation.

Evaluate the explanation based on:
1. Accuracy - Is the explanation factually correct?
2. Completeness - Does it cover the key aspects of the concept?
3. Clarity - Is the explanation clear and well-structured?
4. Understanding - Does it show genuine comprehension vs rote memorization?

Provide your evaluation as a JSON object with:
- score: A number from 0-100
- feedback: A brief, encouraging overall assessment (2-3 sentences)
- strengths: An array of 1-3 things the student did well
- improvements: An array of 1-3 suggestions for improvement

Be encouraging but honest. Consider that these are students who may be preparing for exams like WAEC and JAMB.`;

    const userPrompt = `Concept to explain: "${concept}"

Student's explanation: "${explanation}"

Evaluate this explanation and provide your assessment as JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_evaluation",
              description: "Submit the evaluation of the student's explanation",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Score from 0-100" },
                  feedback: { type: "string", description: "Brief overall feedback" },
                  strengths: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of strengths"
                  },
                  improvements: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of areas to improve"
                  },
                },
                required: ["score", "feedback", "strengths", "improvements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_evaluation" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Failed to evaluate explanation");
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No evaluation generated");
    }

    const evaluation = JSON.parse(toolCall.function.arguments);
    
    console.log("Evaluation result:", evaluation);

    return new Response(JSON.stringify(evaluation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in explain-back-evaluate:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to evaluate explanation" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
