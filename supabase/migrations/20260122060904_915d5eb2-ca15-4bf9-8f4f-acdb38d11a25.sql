-- Fix: Add security_invoker to leaderboard views for explicit RLS enforcement
-- This ensures views respect RLS policies of underlying tables

-- Enable security invoker on leaderboard_quiz_scores view
ALTER VIEW public.leaderboard_quiz_scores SET (security_invoker = true);

-- Enable security invoker on leaderboard_badges view  
ALTER VIEW public.leaderboard_badges SET (security_invoker = true);