import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferralRequest {
  action: "validate" | "apply" | "get-stats";
  referralCode?: string;
}

// Credits awarded for successful referral - BOTH referrer and referred get this
const REFERRAL_CREDITS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, referralCode }: ReferralRequest = await req.json();

    if (action === "validate") {
      // Check if referral code is valid and not the user's own code
      if (!referralCode) {
        return new Response(
          JSON.stringify({ valid: false, error: "Referral code required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: referrer, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, referral_code")
        .eq("referral_code", referralCode.toUpperCase())
        .maybeSingle();

      if (error || !referrer) {
        return new Response(
          JSON.stringify({ valid: false, error: "Invalid referral code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (referrer.user_id === userId) {
        return new Response(
          JSON.stringify({ valid: false, error: "You cannot use your own referral code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already used a referral
      const { data: existingRef } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_id", userId)
        .maybeSingle();

      if (existingRef) {
        return new Response(
          JSON.stringify({ valid: false, error: "You have already used a referral code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          valid: true, 
          referrerName: referrer.full_name || "A TalkPDF user",
          credits: REFERRAL_CREDITS,
          message: `You'll both get ${REFERRAL_CREDITS} bonus credits!`
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "apply") {
      if (!referralCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Referral code required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get referrer
      const { data: referrer, error: refError } = await supabase
        .from("profiles")
        .select("user_id, referral_code, full_name")
        .eq("referral_code", referralCode.toUpperCase())
        .maybeSingle();

      if (refError || !referrer || referrer.user_id === userId) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid referral code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already referred
      const { data: existingRef } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_id", userId)
        .maybeSingle();

      if (existingRef) {
        return new Response(
          JSON.stringify({ success: false, error: "You have already used a referral code" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create referral record (credits awarded to BOTH)
      const { error: insertError } = await supabase
        .from("referrals")
        .insert({
          referrer_id: referrer.user_id,
          referred_id: userId,
          referral_code: referralCode.toUpperCase(),
          status: "completed",
          credits_awarded: REFERRAL_CREDITS * 2, // Track total credits awarded (both users)
          completed_at: new Date().toISOString()
        });

      if (insertError) {
        console.error("Failed to create referral:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to apply referral" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Award credits to REFERRER
      const { data: referrerProfile } = await supabase
        .from("profiles")
        .select("referral_credits")
        .eq("user_id", referrer.user_id)
        .single();

      const referrerCurrentCredits = referrerProfile?.referral_credits || 0;
      
      await supabase
        .from("profiles")
        .update({ referral_credits: referrerCurrentCredits + REFERRAL_CREDITS })
        .eq("user_id", referrer.user_id);

      console.log(`Awarded ${REFERRAL_CREDITS} credits to referrer ${referrer.user_id}`);

      // Award credits to REFERRED USER (this was missing!)
      const { data: referredProfile } = await supabase
        .from("profiles")
        .select("referral_credits, full_name")
        .eq("user_id", userId)
        .single();

      const referredCurrentCredits = referredProfile?.referral_credits || 0;
      
      await supabase
        .from("profiles")
        .update({ 
          referral_credits: referredCurrentCredits + REFERRAL_CREDITS,
          referred_by: referrer.user_id 
        })
        .eq("user_id", userId);

      console.log(`Awarded ${REFERRAL_CREDITS} credits to referred user ${userId}`);

      const referredName = referredProfile?.full_name || "A new user";

      // Send email notification to referrer (fire and forget)
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/referral-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            referrerId: referrer.user_id,
            referredName,
            creditsAwarded: REFERRAL_CREDITS,
          }),
        });
        console.log("Referral notification sent to referrer");
      } catch (emailError) {
        console.error("Failed to send referral notification email:", emailError);
        // Don't fail the main request if email fails
      }

      console.log(`Referral applied: ${userId} referred by ${referrer.user_id}, both received ${REFERRAL_CREDITS} credits`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Referral applied! You and ${referrer.full_name || 'your referrer'} each got ${REFERRAL_CREDITS} bonus credits!`,
          credits: REFERRAL_CREDITS,
          referrerCredits: REFERRAL_CREDITS,
          referredCredits: REFERRAL_CREDITS
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-stats") {
      // Get user's referral stats
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code, referral_credits")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: referrals, error: refError } = await supabase
        .from("referrals")
        .select("id, status, created_at, completed_at")
        .eq("referrer_id", userId);

      const completedReferrals = referrals?.filter(r => r.status === "completed").length || 0;
      const pendingReferrals = referrals?.filter(r => r.status === "pending").length || 0;

      return new Response(
        JSON.stringify({
          referralCode: profile?.referral_code || null,
          totalCredits: profile?.referral_credits || 0,
          completedReferrals,
          pendingReferrals,
          creditsPerReferral: REFERRAL_CREDITS
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Referral error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
