BEGIN;

-- Defense in depth: unauthenticated clients should never have direct table privileges
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.payments FROM anon;

-- Remove misleading/duplicative "block anon" policies (RLS already defaults to deny)
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

DROP POLICY IF EXISTS "Block anonymous access to payments" ON public.payments;
DROP POLICY IF EXISTS "Block anonymous insert to payments" ON public.payments;
DROP POLICY IF EXISTS "Block anonymous update to payments" ON public.payments;

COMMIT;