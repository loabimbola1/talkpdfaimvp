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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message, conversationHistory }: ChatRequest = await req.json();

    // Validate message input
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Message must be less than 2000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate conversation history
    const validHistory = Array.isArray(conversationHistory) 
      ? conversationHistory.slice(-6).filter(m => 
          m && typeof m.role === "string" && typeof m.content === "string"
        )
      : [];

    const isPremium = userPlan === "plus" || userPlan === "pro";
    
    const systemPrompt = `You are a helpful customer support assistant for TalkPDF AI, an AI-powered learning platform designed for Nigerian students.

TalkPDF AI Key Information:
- Converts PDFs into audio in 5 Nigerian languages: English, Yoruba, Hausa, Igbo, and Nigerian Pidgin
- Has "Explain-Back Mode" where students explain concepts back and AI evaluates their understanding
- Designed for WAEC, JAMB, and other exam preparation

Pricing Plans (Updated Jan 2026):
- Free: 5 audio minutes/day, 2 PDFs/day, no Explain-Back Mode
- Plus (₦3,500/month or ₦36,000/year - Save ₦6,000 annually): 60 minutes, 20 PDFs/day, Explain-Back Mode, 3 Nigerian languages (Yoruba, Igbo, Pidgin)
- Pro (₦8,500/month or ₦84,000/year - Save ₦18,000 annually): Unlimited everything, all 5 languages, offline downloads, priority support

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
        temperature: 0.7
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
