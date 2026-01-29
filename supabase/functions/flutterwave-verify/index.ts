import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PRICE_MAP, CURRENCY, type BillingCycle } from "../_shared/pricing.ts";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 10 verifications per minute per user
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 10 };

interface VerifyRequest {
  transaction_id: string;
  tx_ref: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const logPrefix = `[verify:${requestId}]`;

  try {
    const FLUTTERWAVE_CLIENT_SECRET = Deno.env.get("FLUTTERWAVE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FLUTTERWAVE_CLIENT_SECRET) {
      console.error(logPrefix, "Missing Flutterwave API credentials");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(logPrefix, "Missing backend configuration");
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.warn(logPrefix, "Missing or invalid auth header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      console.error(logPrefix, "Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting check
    cleanupRateLimits();
    const rateLimit = checkRateLimit(user.id, "flutterwave-verify", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      console.warn(logPrefix, "Rate limit exceeded for user:", user.id);
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { transaction_id, tx_ref }: VerifyRequest = await req.json();

    if (!transaction_id || !tx_ref) {
      console.warn(logPrefix, "Missing transaction details", { transaction_id: !!transaction_id, tx_ref: !!tx_ref });
      return new Response(JSON.stringify({ error: "Missing transaction details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(logPrefix, "Starting verification", { transaction_id, tx_ref, userId: user.id });

    // Fetch the pending payment and ensure it belongs to the caller (tx_ref ownership check)
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("flutterwave_tx_ref", tx_ref)
      .maybeSingle();

    if (paymentError) {
      console.error(logPrefix, "Failed to fetch payment:", paymentError.message);
      return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment) {
      console.warn(logPrefix, "Payment not found for tx_ref:", tx_ref);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership check: tx_ref must belong to the authenticated user
    if (payment.user_id !== user.id) {
      console.error(logPrefix, "Ownership mismatch", { paymentUserId: payment.user_id, requestUserId: user.id });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotent: if already completed, return success without re-processing
    if (payment.status === "completed") {
      console.log(logPrefix, "Payment already verified (idempotent)", { paymentId: payment.id });
      return new Response(JSON.stringify({
        success: true,
        message: "Payment already verified",
        plan: payment.plan,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify transaction with Flutterwave
    console.log(logPrefix, "Calling Flutterwave verify API", { transaction_id });
    
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_CLIENT_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyData = await verifyResponse.json();
    
    console.log(logPrefix, "Flutterwave response", { 
      status: verifyData?.status, 
      dataStatus: verifyData?.data?.status,
      amount: verifyData?.data?.amount,
      currency: verifyData?.data?.currency,
    });

    if (verifyData?.status !== "success" || verifyData?.data?.status !== "successful") {
      console.error(logPrefix, "Flutterwave verification failed", { 
        status: verifyData?.status, 
        dataStatus: verifyData?.data?.status 
      });
      
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);

      return new Response(
        JSON.stringify({ success: false, message: "Payment verification failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paymentData = verifyData.data;

    // Security: Validate tx_ref matches
    if (paymentData.tx_ref !== tx_ref) {
      console.error(logPrefix, "tx_ref mismatch", { expected: tx_ref, received: paymentData.tx_ref });
      return new Response(JSON.stringify({ success: false, message: "Invalid transaction reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: Validate amount and currency against server-stored values
    const paidAmount = Number(paymentData.amount);
    const expectedAmount = Number(payment.amount);
    const paidCurrency = String(paymentData.currency ?? "").toUpperCase();
    const expectedCurrency = String(payment.currency ?? "NGN").toUpperCase();

    // Verify against our strict price map as well
    const planPrices = PRICE_MAP[payment.plan];
    const billingCycle = payment.billing_cycle as BillingCycle;
    const validPriceForPlan = planPrices 
      ? (planPrices[billingCycle] === expectedAmount)
      : false;

    if (!validPriceForPlan) {
      console.error(logPrefix, "Plan/price validation failed", {
        plan: payment.plan,
        billingCycle: billingCycle,
        storedAmount: expectedAmount,
        expectedFromMap: planPrices?.[billingCycle],
      });
      
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      
      return new Response(JSON.stringify({ success: false, message: "Invalid plan configuration" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paidCurrency !== expectedCurrency) {
      console.error(logPrefix, "Currency mismatch", { paidCurrency, expectedCurrency });
      
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);

      return new Response(JSON.stringify({ success: false, message: "Currency mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (paidAmount < expectedAmount) {
      console.error(logPrefix, "Amount validation failed", { paidAmount, expectedAmount });
      
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);

      return new Response(JSON.stringify({ success: false, message: "Invalid payment amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(logPrefix, "All validations passed, updating payment record");

    // Update payment record
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        flutterwave_tx_id: String(paymentData.id),
        status: "completed",
      })
      .eq("id", payment.id)
      .select()
      .single();

    if (updateError) {
      console.error(logPrefix, "Database error updating payment:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to update payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user's subscription plan AND reset subscription_started_at for credit tracking
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_plan: updatedPayment.plan,
        subscription_status: "active",
        subscription_started_at: new Date().toISOString(), // CRITICAL: Reset for credit tracking
      })
      .eq("user_id", updatedPayment.user_id);

    if (profileError) {
      console.error(logPrefix, "Database error updating profile:", profileError.message);
      // Don't fail the request; payment is already confirmed.
    }

    console.log(logPrefix, "Payment verification complete - subscription_started_at reset", { 
      paymentId: payment.id, 
      plan: updatedPayment.plan,
      userId: user.id 
    });

    // Send payment success email notification
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", user.id)
        .single();

      if (profile?.email) {
        await fetch(`${SUPABASE_URL}/functions/v1/send-payment-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: user.id,
            email: profile.email,
            fullName: profile.full_name,
            plan: updatedPayment.plan,
            amount: Number(updatedPayment.amount),
            status: "success",
            transactionRef: tx_ref,
          }),
        });
        console.log(logPrefix, "Payment success email sent");
      }
    } catch (emailError) {
      console.error(logPrefix, "Failed to send payment email:", emailError);
      // Don't fail the request; payment is already confirmed
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully! Your credits have been reset.",
        plan: updatedPayment.plan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(logPrefix, "Verification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
