
-- Revoke all privileges from anon role on sensitive tables
-- This prevents unauthenticated access even with RLS policies in place
REVOKE ALL PRIVILEGES ON public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON public.payments FROM anon;
REVOKE ALL PRIVILEGES ON public.referrals FROM anon;
