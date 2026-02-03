import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, cleanupRateLimits, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 30 requests per minute per admin
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Admin dashboard: Missing authorization header");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create a client with the user's JWT to verify their identity
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      console.log("Admin dashboard: Invalid token", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Create admin client with service role key to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify user has admin role
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError && roleError.code !== "PGRST116") {
      console.error("Admin dashboard: Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!roleData) {
      console.log("Admin dashboard: User is not an admin:", user.id);
      return new Response(
        JSON.stringify({ error: "Access denied. Admin privileges required." }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Rate limiting check (after admin verification to avoid leaking user info)
    cleanupRateLimits();
    const rateLimit = checkRateLimit(user.id, "admin-dashboard-data", RATE_LIMIT_CONFIG);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetIn, corsHeaders);
    }

    console.log("Admin dashboard: Fetching data for admin user:", user.id);

    // Fetch all admin dashboard data using service role (bypasses RLS)
    const [usersResult, paymentsResult, usageResult] = await Promise.all([
      adminClient
        .from("profiles")
        .select("id, user_id, full_name, email, subscription_plan, subscription_status, created_at, university, referral_credits")
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient
        .from("payments")
        .select("id, plan, amount, status, billing_cycle, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient
        .from("usage_tracking")
        .select("id, action_type, tokens_used, audio_minutes_used, created_at")
        .order("created_at", { ascending: false })
        .limit(100)
    ]);

    if (usersResult.error) {
      console.error("Admin dashboard: Error fetching users:", usersResult.error);
    }
    if (paymentsResult.error) {
      console.error("Admin dashboard: Error fetching payments:", paymentsResult.error);
    }
    if (usageResult.error) {
      console.error("Admin dashboard: Error fetching usage:", usageResult.error);
    }

    const response = {
      users: usersResult.data || [],
      payments: paymentsResult.data || [],
      usageStats: usageResult.data || [],
    };

    console.log("Admin dashboard: Successfully fetched data -", 
      `${response.users.length} users,`,
      `${response.payments.length} payments,`,
      `${response.usageStats.length} usage records`
    );

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Admin dashboard error:", error);
    return new Response(
      JSON.stringify({ error: "Server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
