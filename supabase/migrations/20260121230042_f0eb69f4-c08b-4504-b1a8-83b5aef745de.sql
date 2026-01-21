-- Fix: Remove email from leaderboard views to prevent email exposure
-- The leaderboard_badges view currently exposes email addresses

-- Drop and recreate leaderboard_badges view without email
DROP VIEW IF EXISTS public.leaderboard_badges;

CREATE VIEW public.leaderboard_badges 
WITH (security_invoker=on) AS
SELECT 
  b.user_id,
  b.badge_type,
  b.score,
  p.full_name,
  p.university
FROM public.badges b
INNER JOIN public.profiles p ON p.user_id = b.user_id
WHERE p.leaderboard_opt_in = true;

-- Recreate leaderboard_quiz_scores to be consistent (already doesn't have email, but ensure it's clean)
DROP VIEW IF EXISTS public.leaderboard_quiz_scores;

CREATE VIEW public.leaderboard_quiz_scores 
WITH (security_invoker=on) AS
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

-- Grant select on views to authenticated users
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;
GRANT SELECT ON public.leaderboard_badges TO authenticated;