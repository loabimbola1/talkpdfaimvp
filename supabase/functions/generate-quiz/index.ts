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
    const { documentId, documentSummary, studyPrompts, quizType } = await req.json();

    if (!documentSummary) {
      throw new Error("Document summary is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const quizTypeInstructions = {
      "multiple-choice": "Generate multiple-choice questions with 4 options (A, B, C, D). One answer must be correct.",
      "true-false": "Generate true/false questions. The answer must be either true or false.",
      "fill-blanks": "Generate fill-in-the-blank questions. Use _____ to indicate the blank. Provide the correct answer.",
      "faq": "Generate frequently asked questions about the content with detailed answers.",
      "mixed": "Generate a mix of multiple-choice, true/false, and fill-in-the-blank questions."
    };

    const systemPrompt = `You are the TalkPDF AI Quiz Generator for Nigerian students preparing for WAEC and JAMB exams.
Generate quiz questions based on the document content provided.

**Quiz Type:** ${quizType || "mixed"}
**Instructions:** ${quizTypeInstructions[quizType as keyof typeof quizTypeInstructions] || quizTypeInstructions.mixed}

**Guidelines:**
- Create challenging but fair questions that test understanding, not just memorization
- Use Nigerian context where appropriate to make questions relatable
- Include questions of varying difficulty (easy, medium, hard)
- For multiple choice, make distractors plausible but clearly incorrect
- Provide clear explanations for correct answers

Generate 5-8 questions based on the content.`;

    const userPrompt = `**Document Summary:**
${documentSummary}

${studyPrompts ? `**Key Concepts to Cover:**
${JSON.stringify(studyPrompts)}` : ""}

Generate a quiz with ${quizType || "mixed"} question type(s).`;

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
              name: "submit_quiz",
              description: "Submit the generated quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Unique question ID" },
                        type: { 
                          type: "string", 
                          enum: ["multiple-choice", "true-false", "fill-blanks", "faq"],
                          description: "Question type" 
                        },
                        question: { type: "string", description: "The question text" },
                        options: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "Options for multiple choice (A, B, C, D)" 
                        },
                        correctAnswer: { type: "string", description: "The correct answer" },
                        explanation: { type: "string", description: "Explanation of the correct answer" },
                        difficulty: { 
                          type: "string", 
                          enum: ["easy", "medium", "hard"],
                          description: "Question difficulty level"
                        }
                      },
                      required: ["id", "type", "question", "correctAnswer", "explanation", "difficulty"]
                    }
                  }
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_quiz" } },
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
      
      throw new Error("Failed to generate quiz");
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No quiz generated");
    }

    const quiz = JSON.parse(toolCall.function.arguments);
    
    console.log("Quiz generated:", quiz);

    return new Response(JSON.stringify(quiz), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-quiz:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate quiz" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
