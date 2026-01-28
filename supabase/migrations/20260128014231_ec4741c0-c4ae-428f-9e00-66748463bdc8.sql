-- Security Fix Migration: Block anonymous access and ensure proper RLS

-- ============================================================================
-- FIX 1: Block anonymous access to profiles table
-- The existing policies are RESTRICTIVE which means they filter results.
-- We need to explicitly deny anonymous access.
-- ============================================================================

-- Add policy to explicitly block anonymous (unauthenticated) access to profiles
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- ============================================================================
-- FIX 2: Block anonymous access to payments table
-- ============================================================================

-- Add policy to explicitly block anonymous (unauthenticated) access to payments
CREATE POLICY "Block anonymous access to payments"
ON public.payments
FOR SELECT
TO anon
USING (false);

-- Block anonymous INSERT/UPDATE/DELETE on payments as well
CREATE POLICY "Block anonymous insert to payments"
ON public.payments
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Block anonymous update to payments"
ON public.payments
FOR UPDATE
TO anon
USING (false);

-- ============================================================================
-- FIX 3: Ensure leaderboard_quiz_scores view properly filters only opted-in users
-- The view already has security_invoker = true and filters by leaderboard_opt_in
-- but we should verify it only shows opted-in users
-- ============================================================================

-- Drop and recreate the leaderboard_quiz_scores view to ensure proper filtering
DROP VIEW IF EXISTS public.leaderboard_quiz_scores;

CREATE VIEW public.leaderboard_quiz_scores 
WITH (security_invoker = true) AS
SELECT 
  qs.user_id,
  qs.score,
  qs.total_questions,
  qs.completed_at,
  qs.quiz_type,
  p.full_name,
  p.university
FROM public.quiz_scores qs
INNER JOIN public.profiles p ON qs.user_id = p.user_id
WHERE p.leaderboard_opt_in = true;

-- Grant SELECT on the view to authenticated users only
REVOKE ALL ON public.leaderboard_quiz_scores FROM anon;
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;

-- ============================================================================
-- FIX 4: Ensure leaderboard_profiles view also blocks anon access
-- ============================================================================

-- Revoke anon access from leaderboard views
REVOKE ALL ON public.leaderboard_profiles FROM anon;
GRANT SELECT ON public.leaderboard_profiles TO authenticated;

REVOKE ALL ON public.leaderboard_badges FROM anon;
GRANT SELECT ON public.leaderboard_badges TO authenticated;

-- ============================================================================
-- FIX 5: Ensure user_payments_safe view also blocks anon access
-- ============================================================================

REVOKE ALL ON public.user_payments_safe FROM anon;
GRANT SELECT ON public.user_payments_safe TO authenticated;