import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentEmailRequest {
  userId: string;
  email: string;
  fullName?: string;
  plan: string;
  amount: number;
  status: "success" | "failed";
  transactionRef?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(RESEND_API_KEY);
    
    const { userId, email, fullName, plan, amount, status, transactionRef }: PaymentEmailRequest = await req.json();

    if (!email || !plan || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const displayName = fullName || email.split("@")[0];
    const planDisplayName = plan.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    let subject: string;
    let htmlContent: string;

    if (status === "success") {
      subject = `🎉 Payment Successful - Welcome to ${planDisplayName}!`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Successful! 🎉</h1>
            </div>
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hi ${displayName},</p>
              <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
                Thank you for subscribing to <strong style="color: #10b981;">${planDisplayName}</strong>! Your payment has been processed successfully.
              </p>
              
              <div style="background-color: #f0fdf4; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #166534; margin-top: 0;">Payment Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Plan:</td>
                    <td style="padding: 8px 0; color: #374151; font-weight: 600; text-align: right;">${planDisplayName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
                    <td style="padding: 8px 0; color: #374151; font-weight: 600; text-align: right;">${formattedAmount}</td>
                  </tr>
                  ${transactionRef ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Reference:</td>
                    <td style="padding: 8px 0; color: #374151; font-size: 12px; text-align: right;">${transactionRef}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              
              <p style="color: #6b7280; line-height: 1.6; margin-bottom: 30px;">
                You now have access to all premium features. Start learning smarter today!
              </p>
              
              <div style="text-align: center;">
                <a href="https://www.talkpdf.online/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Go to Dashboard →
                </a>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} TalkPDF AI. Learn smarter, not harder.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      subject = `⚠️ Payment Failed - Action Required`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Payment Failed</h1>
            </div>
            <div style="padding: 40px 30px;">
              <p style="font-size: 18px; color: #374151; margin-bottom: 20px;">Hi ${displayName},</p>
              <p style="color: #6b7280; line-height: 1.6; margin-bottom: 20px;">
                Unfortunately, your payment for <strong>${planDisplayName}</strong> could not be processed.
              </p>
              
              <div style="background-color: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #991b1b; margin-top: 0;">What you can do:</h3>
                <ul style="color: #6b7280; line-height: 1.8; padding-left: 20px;">
                  <li>Check your card details and try again</li>
                  <li>Ensure you have sufficient funds</li>
                  <li>Try a different payment method</li>
                  <li>Contact your bank if the issue persists</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="https://www.talkpdf.online/dashboard?tab=subscription" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Try Again →
                </a>
              </div>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Need help? Reply to this email and we'll assist you.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "TalkPDF AI <onboarding@resend.dev>",
      to: [email],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: (emailResponse as any).id || "sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending payment email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
