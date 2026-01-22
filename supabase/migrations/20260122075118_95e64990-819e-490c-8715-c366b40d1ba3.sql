-- Drop overly permissive policies
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "System can update referrals" ON public.referrals;

-- Create proper RLS policies - referrals are managed by service role (edge functions)
-- Users can only view their own referrals (already created)
-- For inserts/updates, we'll use service role in edge functions

-- Allow users to insert referrals where they are the referrer
CREATE POLICY "Users can create referrals as referrer" 
ON public.referrals 
FOR INSERT 
WITH CHECK (auth.uid() = referrer_id);

-- Allow referrer to view completed referrals
CREATE POLICY "Referrers can update their referrals" 
ON public.referrals 
FOR UPDATE 
USING (auth.uid() = referrer_id);