-- Fix quiz_scores unrestricted access issue
-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all quiz scores for leaderboard" ON public.quiz_scores;

-- 2. Add leaderboard_opt_in column to profiles for privacy control
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS leaderboard_opt_in boolean DEFAULT true;

-- 3. Create a secure leaderboard view that only shows opted-in users
-- This allows the leaderboard to function while respecting privacy
CREATE OR REPLACE VIEW public.leaderboard_quiz_scores 
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

-- 4. Create leaderboard badges view for the badges leaderboard
CREATE OR REPLACE VIEW public.leaderboard_badges 
WITH (security_invoker=on) AS
SELECT 
  b.user_id,
  b.badge_type,
  b.score,
  p.full_name,
  p.email,
  p.university
FROM public.badges b
INNER JOIN public.profiles p ON p.user_id = b.user_id
WHERE p.leaderboard_opt_in = true;

-- 5. Grant select on views to authenticated users
GRANT SELECT ON public.leaderboard_quiz_scores TO authenticated;
GRANT SELECT ON public.leaderboard_badges TO authenticated;

-- 6. Update profiles RLS to allow reading basic info of opted-in users for leaderboards
CREATE POLICY "Users can view opted-in profiles for leaderboard"
ON public.profiles
FOR SELECT
USING (leaderboard_opt_in = true);

-- 7. Update badges RLS to allow reading badges of opted-in users
CREATE POLICY "Users can view badges of opted-in users for leaderboard"
ON public.badges
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = badges.user_id 
    AND profiles.leaderboard_opt_in = true
  )
);