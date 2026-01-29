-- Add admin SELECT policy for profiles table
-- This allows admin users to view all profiles for the admin dashboard
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));