import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  amount: number;
  plan: string;
  billingCycle: "monthly" | "yearly";
  email: string;
  name: string;
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLUTTERWAVE_CLIENT_ID = Deno.env.get("FLUTTERWAVE_CLIENT_ID");
    const FLUTTERWAVE_CLIENT_SECRET = Deno.env.get("FLUTTERWAVE_CLIENT_SECRET");
    const FLUTTERWAVE_ENCRYPTION_KEY = Deno.env.get("FLUTTERWAVE_ENCRYPTION_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!FLUTTERWAVE_CLIENT_ID || !FLUTTERWAVE_CLIENT_SECRET || !FLUTTERWAVE_ENCRYPTION_KEY) {
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

    const { amount, plan, billingCycle, email, name, userId }: PaymentRequest =
      await req.json();

    console.log("Processing payment request:", { amount, plan, billingCycle, email, userId });

    // Generate unique transaction reference
    const tx_ref = `TALKPDF_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Store pending payment in database
    const { error: dbError } = await supabase.from("payments").insert({
      user_id: userId,
      flutterwave_tx_ref: tx_ref,
      amount,
      currency: "NGN",
      plan,
      billing_cycle: billingCycle,
      status: "pending",
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Flutterwave payment link
    const flutterwavePayload = {
      tx_ref,
      amount,
      currency: "NGN",
      redirect_url: `${req.headers.get("origin")}/payment/callback`,
      customer: {
        email,
        name,
      },
      customizations: {
        title: "TalkPDF AI",
        description: `${plan} Plan - ${billingCycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
        logo: "https://talkpdf.ai/logo.png",
      },
      meta: {
        plan,
        billing_cycle: billingCycle,
        user_id: userId,
      },
    };

    console.log("Creating Flutterwave payment:", flutterwavePayload);

    const flutterwaveResponse = await fetch(
      "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_CLIENT_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(flutterwavePayload),
      }
    );

    const flutterwaveData = await flutterwaveResponse.json();

    console.log("Flutterwave response:", flutterwaveData);

    if (flutterwaveData.status !== "success") {
      console.error("Flutterwave error:", flutterwaveData);
      return new Response(
        JSON.stringify({ error: flutterwaveData.message || "Payment initialization failed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLink: flutterwaveData.data.link,
        tx_ref,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Payment processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
