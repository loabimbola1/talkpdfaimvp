-- Fix security issues: Block anonymous access to sensitive tables and views
-- Issue 1: profiles table - revoke anon access
REVOKE ALL ON public.profiles FROM anon;

-- Issue 2: payments table - revoke anon access  
REVOKE ALL ON public.payments FROM anon;

-- Issue 3: leaderboard_quiz_scores view - requires authentication to view
-- The view already filters by leaderboard_opt_in, but we need to ensure anon cannot access
-- We need to recreate the view with SECURITY INVOKER to enforce RLS
DROP VIEW IF EXISTS public.leaderboard_quiz_scores;

CREATE VIEW public.leaderboard_quiz_scores
WITH (security_invoker = true, security_barrier = true)
AS
SELECT 
  qs.user_id,
  qs.score,
  qs.total_questions,
  qs.completed_at,
  qs.quiz_type,
  p.full_name,
  p.university
FROM public.quiz_scores qs
JOIN public.profiles p ON p.user_id = qs.user_id
WHERE p.leaderboard_opt_in = true;

-- Grant SELECT only to authenticated users (not anon)
REVOKE ALL ON public.leaderboard_quiz_scores FROM anon;
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;

-- Ensure authenticated users can still access profiles and payments with proper RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;

-- Add comments for documentation
COMMENT ON VIEW public.leaderboard_quiz_scores IS 'Secure view that only exposes quiz scores for users who opted into leaderboard. Requires authentication.';