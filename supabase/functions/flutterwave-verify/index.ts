import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLUTTERWAVE_CLIENT_SECRET = Deno.env.get("FLUTTERWAVE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FLUTTERWAVE_CLIENT_SECRET) {
      console.error("Missing Flutterwave API credentials");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { transaction_id, tx_ref } = await req.json();

    console.log("Verifying payment:", { transaction_id, tx_ref });

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

    console.log("Flutterwave verification response:", verifyData);

    if (verifyData.status !== "success" || verifyData.data.status !== "successful") {
      // Update payment status to failed
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("flutterwave_tx_ref", tx_ref);

      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Payment verification failed" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paymentData = verifyData.data;

    // Update payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .update({
        flutterwave_tx_id: paymentData.id.toString(),
        status: "completed",
      })
      .eq("flutterwave_tx_ref", tx_ref)
      .select()
      .single();

    if (paymentError) {
      console.error("Database error updating payment:", paymentError);
    }

    // Update user's subscription plan
    if (payment) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          subscription_plan: payment.plan,
          subscription_status: "active",
        })
        .eq("user_id", payment.user_id);

      if (profileError) {
        console.error("Database error updating profile:", profileError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
        plan: payment?.plan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
