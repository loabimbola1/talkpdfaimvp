-- Revoke all privileges from anon role on profiles table to prevent anonymous access
REVOKE ALL ON public.profiles FROM anon;

-- Revoke all privileges from anon role on payments table to prevent anonymous access  
REVOKE ALL ON public.payments FROM anon;

-- Grant access only to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;