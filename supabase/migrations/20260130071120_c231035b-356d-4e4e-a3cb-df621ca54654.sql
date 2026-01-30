-- Fix Security Issue 1: Enable RLS on leaderboard views to block anonymous access
-- The views already filter to opted-in users only and don't expose emails
-- But we need to ensure only authenticated users can access them

-- Enable RLS on leaderboard_profiles view
ALTER VIEW public.leaderboard_profiles SET (security_invoker = true, security_barrier = true);

-- Enable RLS on leaderboard_badges view  
ALTER VIEW public.leaderboard_badges SET (security_invoker = true, security_barrier = true);

-- Enable RLS on leaderboard_quiz_scores view
ALTER VIEW public.leaderboard_quiz_scores SET (security_invoker = true, security_barrier = true);

-- Revoke access from anon role on leaderboard views (block anonymous access)
REVOKE ALL ON public.leaderboard_profiles FROM anon;
REVOKE ALL ON public.leaderboard_badges FROM anon;
REVOKE ALL ON public.leaderboard_quiz_scores FROM anon;

-- Grant SELECT only to authenticated users on leaderboard views
GRANT SELECT ON public.leaderboard_profiles TO authenticated;
GRANT SELECT ON public.leaderboard_badges TO authenticated;
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;

-- Fix Security Issue 2: Secure the user_payments_safe view
-- Currently it exposes ALL payment records to everyone - major security issue!

-- Enable security options on user_payments_safe view
ALTER VIEW public.user_payments_safe SET (security_invoker = true, security_barrier = true);

-- Revoke all access from anon role (block anonymous access completely)
REVOKE ALL ON public.user_payments_safe FROM anon;

-- Grant SELECT only to authenticated users 
GRANT SELECT ON public.user_payments_safe TO authenticated;

-- Since the view doesn't have a WHERE clause to filter by user, we need to recreate it
-- to ensure users can only see their OWN payment records

-- Drop and recreate the view with proper user filtering
DROP VIEW IF EXISTS public.user_payments_safe;

CREATE VIEW public.user_payments_safe 
WITH (security_invoker = true, security_barrier = true) AS
SELECT 
    id,
    user_id,
    amount,
    currency,
    plan,
    billing_cycle,
    status,
    created_at,
    updated_at
FROM payments
WHERE user_id = auth.uid();

-- Set proper permissions
REVOKE ALL ON public.user_payments_safe FROM anon;
GRANT SELECT ON public.user_payments_safe TO authenticated;

COMMENT ON VIEW public.user_payments_safe IS 'Secure view that only shows the current authenticated user their own payment records. Excludes sensitive Flutterwave transaction IDs.';