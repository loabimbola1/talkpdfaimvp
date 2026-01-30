import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header for user verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user token to verify their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Create admin client to check roles (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify admin role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!roleData) {
      console.log('User is not admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified, processing request');

    // Parse request body
    const { action, referralId, referrerId, creditsToRevoke } = await req.json();
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing action parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process admin actions using service role (bypasses RLS)
    switch (action) {
      case 'dismiss_flag': {
        if (!referralId) {
          return new Response(
            JSON.stringify({ error: 'Missing referralId for dismiss_flag action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await adminClient
          .from('referrals')
          .update({ flagged_suspicious: false })
          .eq('id', referralId);

        if (updateError) {
          console.error('Error dismissing flag:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to dismiss flag' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Flag dismissed for referral:', referralId);
        return new Response(
          JSON.stringify({ success: true, message: 'Flag dismissed successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revoke_credits': {
        if (!referralId || !referrerId) {
          return new Response(
            JSON.stringify({ error: 'Missing referralId or referrerId for revoke_credits action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch current credits for the referrer
        const { data: profileData, error: fetchError } = await adminClient
          .from('profiles')
          .select('referral_credits')
          .eq('user_id', referrerId)
          .single();

        if (fetchError) {
          console.error('Error fetching profile:', fetchError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch referrer profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentCredits = profileData?.referral_credits ?? 0;
        const toRevoke = creditsToRevoke ?? 0;
        const newCredits = Math.max(0, currentCredits - toRevoke);

        // Update profile with new credits
        const { error: profileError } = await adminClient
          .from('profiles')
          .update({ referral_credits: newCredits })
          .eq('user_id', referrerId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          return new Response(
            JSON.stringify({ error: 'Failed to update referrer credits' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update referral status
        const { error: refError } = await adminClient
          .from('referrals')
          .update({ 
            status: 'revoked',
            credits_awarded: 0,
            flagged_suspicious: true
          })
          .eq('id', referralId);

        if (refError) {
          console.error('Error updating referral:', refError);
          return new Response(
            JSON.stringify({ error: 'Failed to update referral status' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Credits revoked for referrer:', referrerId, 'amount:', toRevoke);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Revoked ${toRevoke} credits from referrer`,
            newCredits 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
