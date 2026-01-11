-- Add DELETE policy for profiles table to enable GDPR compliance
CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);