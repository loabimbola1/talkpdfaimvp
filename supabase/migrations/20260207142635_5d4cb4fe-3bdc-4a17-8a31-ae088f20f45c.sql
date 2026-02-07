-- Remove the overly permissive leaderboard badge policy from the raw badges table
-- Cross-user badge visibility is already handled by the secure leaderboard_badges view
DROP POLICY IF EXISTS "Users can view badges of opted-in users for leaderboard" ON public.badges;