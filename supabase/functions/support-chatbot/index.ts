import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  message: string;
  userPlan: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, userPlan, conversationHistory }: ChatRequest = await req.json();

    const isPremium = userPlan === "plus" || userPlan === "pro";
    
    const systemPrompt = `You are a helpful customer support assistant for TalkPDF AI, an AI-powered learning platform designed for Nigerian students.

TalkPDF AI Key Information:
- Converts PDFs into audio in 5 Nigerian languages: English, Yoruba, Hausa, Igbo, and Nigerian Pidgin
- Has "Explain-Back Mode" where students explain concepts back and AI evaluates their understanding
- Designed for WAEC, JAMB, and other exam preparation

Pricing Plans:
- Free: 5 audio minutes/day, 2 PDFs/day, no Explain-Back Mode
- Plus (₦2,500/month or ₦24,000/year): 30 minutes, 10 PDFs, Explain-Back Mode
- Pro (₦4,500/month or ₦43,200/year): Unlimited everything, offline downloads, priority support

Current User: ${isPremium ? `Premium (${userPlan}) subscriber - provide VIP treatment` : "Free tier user"}

Guidelines:
1. Be friendly, helpful, and concise
2. Use Nigerian English expressions where appropriate
3. ${isPremium ? "Acknowledge their premium status and provide detailed, thorough support" : "Be helpful but also mention relevant upgrade benefits when appropriate"}
4. For technical issues, suggest contacting asktalkpdfai@gmail.com
5. Keep responses under 150 words unless the question requires detail
6. Use emojis sparingly to be friendly

If you don't know something specific, direct them to the Help Center or contact email.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI response error:", errorText);
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I apologize, but I couldn't process your request.";

    console.log(`Support chatbot response for ${userPlan} user`);

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Support chatbot error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to process request",
        response: "I'm having trouble right now. Please email asktalkpdfai@gmail.com for assistance."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
