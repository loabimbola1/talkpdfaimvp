import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration: 5 submissions per hour per IP
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
};

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

async function sendEmail(to: string[], subject: string, html: string, replyTo?: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "TalkPDF AI <onboarding@resend.dev>",
      to,
      subject,
      html,
      reply_to: replyTo,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  return await response.json();
}

serve(async (req: Request): Promise<Response> => {
  // Cleanup old rate limit entries
  cleanupRateLimits();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit by IP address
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") ||
                     req.headers.get("x-real-ip") ||
                     "anonymous";
    
    const rateLimit = checkRateLimit(clientIP, "contact-form", RATE_LIMIT_CONFIG);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }
    
    const { name, email, subject, message }: ContactFormRequest = await req.json();

    // Input validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (name.length > 100) {
      return new Response(
        JSON.stringify({ error: "Name must be less than 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (email.length > 255) {
      return new Response(
        JSON.stringify({ error: "Email must be less than 255 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Message must be less than 5000 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Sanitize inputs
    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 255);
    const sanitizedMessage = message.trim().substring(0, 5000);
    const sanitizedSubject = subject ? subject.trim().substring(0, 100) : "general";

    const subjectLabels: Record<string, string> = {
      general: "General Inquiry",
      support: "Technical Support",
      billing: "Billing Question",
      feedback: "Feedback",
      partnership: "Partnership",
    };

    const subjectLabel = subjectLabels[subject] || subject || "Contact Form Submission";

    console.log(`Sending contact form email from ${name} (${email})`);

    // Send to support team
    await sendEmail(
      ["asktalkpdfai@gmail.com"],
      `[TalkPDF AI] ${subjectLabel}: ${name}`,
      `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">From</h3>
              <p style="color: #1f2937; margin: 0; font-size: 16px;">${name}</p>
              <p style="color: #6b7280; margin: 4px 0 0 0; font-size: 14px;">${email}</p>
            </div>
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">Subject</h3>
              <p style="color: #1f2937; margin: 0; font-size: 16px;">${subjectLabel}</p>
            </div>
            <div style="margin-bottom: 20px;">
              <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase;">Message</h3>
              <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                <p style="color: #1f2937; margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; margin: 0; font-size: 13px;">
                Reply directly to <a href="mailto:${email}" style="color: #10b981;">${name}</a>
              </p>
            </div>
          </div>
        </div>
      `,
      email
    );

    console.log("Contact email sent to support");

    // Send confirmation to user
    await sendEmail(
      [email],
      "We received your message - TalkPDF AI",
      `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Thank You, ${name}!</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #1f2937; font-size: 16px; line-height: 1.6;">
              We've received your message and will get back to you within 24 hours during business days.
            </p>
            <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px;">Your message:</h3>
              <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${message.substring(0, 300)}${message.length > 300 ? "..." : ""}</p>
            </div>
            <p style="color: #1f2937; font-size: 16px; line-height: 1.6;">
              Check out our <a href="https://www.talkpdf.online/help" style="color: #10b981;">Help Center</a> for instant answers.
            </p>
            <p style="color: #6b7280; margin-top: 30px; font-size: 14px;">
              Best regards,<br>The TalkPDF AI Team
            </p>
          </div>
        </div>
      `
    );

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in contact-form function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
