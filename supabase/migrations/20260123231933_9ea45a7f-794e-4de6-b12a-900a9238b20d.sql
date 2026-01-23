-- Fix Security Definer View issue - recreate views with security_invoker = true
-- This ensures views respect the querying user's RLS policies

-- Drop and recreate leaderboard_profiles view with security invoker
DROP VIEW IF EXISTS public.leaderboard_profiles;

CREATE VIEW public.leaderboard_profiles 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  full_name,
  university,
  referral_credits
FROM public.profiles
WHERE leaderboard_opt_in = true;

-- Grant access to authenticated users only
GRANT SELECT ON public.leaderboard_profiles TO authenticated;

COMMENT ON VIEW public.leaderboard_profiles IS 'Secure view for leaderboard data - excludes email, campus_email, and other PII. Uses security_invoker=true to respect RLS.';

-- Drop and recreate user_payments_safe view with security invoker  
DROP VIEW IF EXISTS public.user_payments_safe;

CREATE VIEW public.user_payments_safe
WITH (security_invoker = true) AS
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
FROM public.payments;

-- Grant access to authenticated users only
GRANT SELECT ON public.user_payments_safe TO authenticated;

COMMENT ON VIEW public.user_payments_safe IS 'Safe payment view - excludes Flutterwave transaction references. Uses security_invoker=true to respect RLS.';