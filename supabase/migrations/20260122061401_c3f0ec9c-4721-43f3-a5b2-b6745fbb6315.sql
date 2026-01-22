-- Fix: Remove email exposure from leaderboard views and profiles policy
-- The views should only show non-sensitive data for public rankings

-- Drop and recreate leaderboard_quiz_scores view without exposing emails
DROP VIEW IF EXISTS public.leaderboard_quiz_scores;
CREATE VIEW public.leaderboard_quiz_scores 
WITH (security_invoker = true)
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
INNER JOIN public.profiles p ON p.user_id = qs.user_id
WHERE p.leaderboard_opt_in = true;

-- Drop and recreate leaderboard_badges view without exposing emails
DROP VIEW IF EXISTS public.leaderboard_badges;
CREATE VIEW public.leaderboard_badges 
WITH (security_invoker = true)
AS
SELECT 
  b.user_id,
  b.score,
  b.badge_type,
  p.full_name,
  p.university
FROM public.badges b
INNER JOIN public.profiles p ON p.user_id = b.user_id
WHERE p.leaderboard_opt_in = true;

-- Grant necessary permissions for authenticated users
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;
GRANT SELECT ON public.leaderboard_badges TO authenticated;