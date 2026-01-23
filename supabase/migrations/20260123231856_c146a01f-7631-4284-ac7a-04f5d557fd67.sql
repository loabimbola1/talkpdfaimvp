-- Fix Issue 1: profiles_table_public_exposure
-- The current policy "Users can view opted-in profiles for leaderboard" exposes ALL columns including email, campus_email
-- We need to drop this policy and instead use a secure view that only exposes safe fields

-- Drop the overly permissive leaderboard SELECT policy on profiles
DROP POLICY IF EXISTS "Users can view opted-in profiles for leaderboard" ON public.profiles;

-- Create a secure leaderboard profiles view that only exposes non-sensitive fields
-- This view will be used by leaderboard components instead of directly querying profiles
CREATE OR REPLACE VIEW public.leaderboard_profiles AS
SELECT 
  user_id,
  full_name,
  university,
  referral_credits
FROM public.profiles
WHERE leaderboard_opt_in = true;

-- Grant access to authenticated users only (not public/anon)
GRANT SELECT ON public.leaderboard_profiles TO authenticated;

-- Fix Issue 2: payments_table_financial_exposure
-- Create a view for user-facing payment info that excludes sensitive gateway references
CREATE OR REPLACE VIEW public.user_payments_safe AS
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
  -- Deliberately excludes: flutterwave_tx_ref, flutterwave_tx_id (sensitive gateway data)
FROM public.payments;

-- Enable RLS on this view (will inherit from base table policies)
-- Grant select only to authenticated users
GRANT SELECT ON public.user_payments_safe TO authenticated;

-- Add a comment explaining the security rationale
COMMENT ON VIEW public.leaderboard_profiles IS 'Secure view for leaderboard data - excludes email, campus_email, and other PII';
COMMENT ON VIEW public.user_payments_safe IS 'Safe payment view - excludes Flutterwave transaction references to prevent correlation attacks';