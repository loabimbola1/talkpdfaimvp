import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 20 messages per minute per user
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,
  maxRequests: 20,
};

interface ChatRequest {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

serve(async (req) => {
  // Cleanup old rate limit entries
  cleanupRateLimits();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - please sign in to use support chat" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate the user's JWT token
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Auth validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Rate limiting by user ID
    const rateLimit = checkRateLimit(userId, "support-chatbot", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    // Get user plan from database (don't trust client-provided value)
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_plan")
      .eq("user_id", userId)
      .maybeSingle();

    const userPlan = profile?.subscription_plan || "free";

    // AI Question limits by plan
    const AI_QUESTION_LIMITS: Record<string, number> = {
      free: 5,
      plus: 30,
      pro: -1, // Unlimited
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, conversationHistory, source }: ChatRequest & { source?: string } = await req.json();

    // Check question limit for Read & Learn sources (document_reader, explain_concept, ask_question)
    const readLearnSources = ["document_reader", "explain_concept", "ask_question"];
    if (source && readLearnSources.includes(source)) {
      const questionLimit = AI_QUESTION_LIMITS[userPlan] || 5;
      
      if (questionLimit !== -1) {
        // Count today's AI questions
        const today = new Date().toISOString().split("T")[0];
        
        const { data: dailyUsage } = await supabaseAdmin
          .from("daily_usage_summary")
          .select("ai_questions_asked")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();
        
        const questionsAsked = dailyUsage?.ai_questions_asked || 0;
        
        if (questionsAsked >= questionLimit) {
          const upgradeMessage = userPlan === "free" 
            ? "Upgrade to Plus for 30 questions/day or Pro for unlimited!"
            : "Upgrade to Pro for unlimited AI questions!";
          
          return new Response(
            JSON.stringify({ 
              error: "Daily question limit reached",
              limitReached: true,
              upgradeMessage
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Validate message input
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length > 4000) {
      return new Response(
        JSON.stringify({ error: "Message must be less than 4000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and truncate conversation history to prevent token overflow
    const validHistory = Array.isArray(conversationHistory) 
      ? conversationHistory.slice(-4).filter(m => 
          m && typeof m.role === "string" && typeof m.content === "string"
        ).map(m => ({
          role: m.role,
          // Truncate long historical messages to keep context manageable
          content: m.content.length > 1000 ? m.content.slice(0, 1000) + "..." : m.content
        }))
      : [];

    const isPremium = userPlan === "plus" || userPlan === "pro";
    
    const systemPrompt = `You are a Nigerian academic tutor with doctorate-level expertise in education and curriculum development. You serve as both a support assistant and academic guide for TalkPDF AI, an AI-powered learning platform for Nigerian students.

YOUR EXPERTISE:
- Deep understanding of Nigerian educational system from JSS to university level
- Expert knowledge of WAEC, NECO, and UTME/JAMB curricula, exam patterns, and past questions
- Fluent in Nigerian English, Pidgin (Naija), with understanding of Yoruba, Hausa, and Igbo expressions
- Experienced in helping students with coursework, study materials, and exam preparation

ACADEMIC ASSISTANCE YOU PROVIDE:
- Help students understand chapters or concepts from their uploaded textbooks and PDFs
- Explain difficult topics in simple, relatable Nigerian context with local examples
- Provide WAEC/NECO/JAMB exam tips, past question patterns, and marking scheme insights
- Break down complex academic concepts into bite-sized, digestible explanations
- Suggest effective study strategies tailored to Nigerian exam systems
- Answer questions in the student's preferred language when asked

TalkPDF AI Key Information:
- Converts PDFs into audio in 5 Nigerian languages: English, Yoruba, Hausa, Igbo, and Nigerian Pidgin
- Has "Explain-Back Mode" where students explain concepts back and AI evaluates their understanding
- Designed specifically for WAEC, JAMB, NECO, and university exam preparation

Pricing Plans (Updated Jan 2026):
- Free: 5 audio minutes/day, 2 PDFs/day, no Explain-Back Mode
- Plus (₦3,500/month or ₦36,000/year - Save ₦6,000 annually): 60 minutes, 20 PDFs/day, Explain-Back Mode, 3 Nigerian languages
- Pro (₦8,500/month or ₦84,000/year - Save ₦18,000 annually): Unlimited everything, all 5 languages, offline downloads, priority support

Current User: ${isPremium ? `Premium (${userPlan}) subscriber - provide VIP treatment with detailed academic support` : "Free tier user"}

RESPONSE QUALITY RULES (CRITICAL):
1. NEVER fabricate information - if you don't know something, say so honestly
2. AVOID filler phrases: "That's a great question!", "I'd be happy to help!", "Great question!"
3. DO NOT repeat the same point multiple times in different words
4. Get straight to the answer without preamble or unnecessary introductions
5. Base answers ONLY on provided context - do not invent facts or statistics
6. Every sentence must add value - no padding or unnecessary elaboration
7. Be direct and concise while remaining friendly

Guidelines:
1. Be friendly, encouraging, and use Nigerian English expressions naturally (e.g., "Oya, let's break it down", "No wahala", "Sharp sharp")
2. ${isPremium ? "Acknowledge their premium status and provide comprehensive, detailed explanations" : "Be helpful but mention upgrade benefits for deeper academic support when appropriate"}
3. For curriculum questions, provide accurate, exam-focused explanations
4. Use local examples and analogies Nigerian students can relate to
5. For technical platform issues, suggest contacting asktalkpdfai@gmail.com
6. ${isPremium ? "Provide detailed, thorough academic responses" : "Keep responses helpful but concise, around 150 words unless more detail is needed"}

If asked about specific textbook content or past questions, encourage users to upload their materials to get personalized audio explanations.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...validHistory,
      { role: "user", content: message.trim() }
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
        temperature: 0.5
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI response error:", errorText);
      
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
      
      throw new Error("Failed to get AI response");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I apologize, but I couldn't process your request.";

    console.log(`Support chatbot response for ${userPlan} user (${userId})`);

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
