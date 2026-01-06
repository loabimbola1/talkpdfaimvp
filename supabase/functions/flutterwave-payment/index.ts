import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type BillingCycle = "monthly" | "yearly";

interface PaymentRequest {
  plan: string;
  billingCycle: BillingCycle;
}

const PRICE_MAP: Record<string, Record<BillingCycle, number>> = {
  student_pro: { monthly: 2000, yearly: 20000 },
  mastery_pass: { monthly: 3500, yearly: 40000 },
};

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

    // Require authenticated caller
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

    const { plan, billingCycle }: PaymentRequest = await req.json();

    if (!plan || !PRICE_MAP[plan]) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (billingCycle !== "monthly" && billingCycle !== "yearly") {
      return new Response(JSON.stringify({ error: "Invalid billing cycle" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = PRICE_MAP[plan][billingCycle];
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure we redirect only back to this site
    const origin = req.headers.get("origin") ?? "";
    if (!origin || !origin.startsWith("http")) {
      return new Response(JSON.stringify({ error: "Invalid origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tx_ref = `TALKPDF_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    console.log("Creating payment", { tx_ref, plan, billingCycle, userId: user.id, amount });

    // Store pending payment in database (server-trusted values only)
    const { error: dbError } = await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      flutterwave_tx_ref: tx_ref,
      amount,
      currency: "NGN",
      plan,
      billing_cycle: billingCycle,
      status: "pending",
    });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(JSON.stringify({ error: "Failed to create payment record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = user.email ?? "";
    const customerName =
      (user.user_metadata?.full_name as string | undefined) ?? customerEmail;

    const flutterwavePayload = {
      tx_ref,
      amount,
      currency: "NGN",
      redirect_url: `${origin.replace(/\/$/, "")}/payment/callback`,
      customer: {
        email: customerEmail,
        name: customerName,
      },
      customizations: {
        title: "TalkPDF AI",
        description: `${plan} Plan - ${billingCycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
      },
      meta: {
        plan,
        billing_cycle: billingCycle,
      },
    };

    const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_CLIENT_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flutterwavePayload),
    });

    const flutterwaveData = await flutterwaveResponse.json();

    if (flutterwaveData?.status !== "success") {
      console.error("Flutterwave init failed", { tx_ref, response: flutterwaveData });

      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("flutterwave_tx_ref", tx_ref);

      return new Response(
        JSON.stringify({ error: flutterwaveData?.message || "Payment initialization failed" }),
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
