import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  transaction_id: string;
  tx_ref: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLUTTERWAVE_CLIENT_SECRET = Deno.env.get("FLUTTERWAVE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FLUTTERWAVE_CLIENT_SECRET) {
      console.error("Missing Flutterwave API credentials");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing backend configuration");
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
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
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { transaction_id, tx_ref }: VerifyRequest = await req.json();

    if (!transaction_id || !tx_ref) {
      return new Response(JSON.stringify({ error: "Missing transaction details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the pending payment and ensure it belongs to the caller
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("flutterwave_tx_ref", tx_ref)
      .maybeSingle();

    if (paymentError) {
      console.error("Failed to fetch payment:", paymentError);
      return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "completed") {
      return new Response(JSON.stringify({
        success: true,
        message: "Payment already verified",
        plan: payment.plan,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Verifying payment", { transaction_id, tx_ref, userId: user.id });

    // Verify transaction with Flutterwave
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

    if (verifyData?.status !== "success" || verifyData?.data?.status !== "successful") {
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

    if (paymentData.tx_ref !== tx_ref) {
      console.error("tx_ref mismatch", { expected: tx_ref, received: paymentData.tx_ref });
      return new Response(JSON.stringify({ success: false, message: "Invalid transaction" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paidAmount = Number(paymentData.amount);
    const expectedAmount = Number(payment.amount);
    const paidCurrency = String(paymentData.currency ?? "").toUpperCase();
    const expectedCurrency = String(payment.currency ?? "NGN").toUpperCase();

    if (paidCurrency !== expectedCurrency || !(paidAmount >= expectedAmount)) {
      console.error("Amount/currency mismatch", {
        paidAmount,
        expectedAmount,
        paidCurrency,
        expectedCurrency,
      });

      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);

      return new Response(JSON.stringify({ success: false, message: "Invalid payment amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.error("Database error updating payment:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user's subscription plan
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_plan: updatedPayment.plan,
        subscription_status: "active",
      })
      .eq("user_id", updatedPayment.user_id);

    if (profileError) {
      console.error("Database error updating profile:", profileError);
      // Don't fail the request; payment is already confirmed.
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
        plan: updatedPayment.plan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

