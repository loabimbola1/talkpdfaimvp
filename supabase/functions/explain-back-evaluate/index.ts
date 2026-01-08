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
    const { concept, explanation, documentId, documentSummary } = await req.json();

    if (!concept || !explanation) {
      throw new Error("Concept and explanation are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // PRD-based scoring system with 3 dimensions: Simplicity, Accuracy, Analogies
    const systemPrompt = `You are the TalkPDF AI Understanding Engine for Nigerian students preparing for WAEC and JAMB exams. Evaluate a student's explanation of a concept.

**Evaluation Dimensions (0-10 each):**
1. Simplicity: Did they avoid jargon and speak plainly? Could a 10-year-old understand?
2. Accuracy: Do they capture the core principles correctly?
3. Analogies: Can they relate it to something familiar from everyday life?

**Badge Scoring (based on total out of 30):**
- Bronze Badge: 15-20 points (50-67%) - Basic understanding shown
- Silver Badge: 21-25 points (70-83%) - Good understanding demonstrated  
- Gold Badge: 26-30 points (87-100%) - Excellent mastery achieved

**Special Cases:**
- If student uses too much textbook jargon, set needsRetry=true with feedback: "That sounds like a textbook definition. Try explaining it like you're teaching a 10-year-old."
- Be encouraging but honest. Nigerian students need honest feedback to improve.

Respond with JSON:
{
  "simplicity": <0-10>,
  "accuracy": <0-10>,
  "analogies": <0-10>,
  "totalScore": <sum>,
  "score": <percentage 0-100>,
  "badge": "bronze" | "silver" | "gold" | null,
  "feedback": "<2-3 sentence overall assessment>",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "needsRetry": true | false
}`;

    const userPrompt = `**Concept to explain:** "${concept}"

${documentSummary ? `**Context from document:** "${documentSummary.substring(0, 500)}"` : ""}

**Student's explanation:** "${explanation}"

Evaluate this explanation using the 3-dimension scoring system.`;

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
              description: "Submit the PRD-based evaluation of the student's explanation",
              parameters: {
                type: "object",
                properties: {
                  simplicity: { type: "number", description: "Simplicity score 0-10" },
                  accuracy: { type: "number", description: "Accuracy score 0-10" },
                  analogies: { type: "number", description: "Analogies score 0-10" },
                  totalScore: { type: "number", description: "Total score out of 30" },
                  score: { type: "number", description: "Percentage score 0-100" },
                  badge: { 
                    type: "string", 
                    enum: ["bronze", "silver", "gold", null],
                    description: "Badge earned based on total score"
                  },
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
                  needsRetry: { 
                    type: "boolean", 
                    description: "Whether the student should try again with simpler language" 
                  },
                },
                required: ["simplicity", "accuracy", "analogies", "totalScore", "score", "feedback", "strengths", "improvements", "needsRetry"],
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
