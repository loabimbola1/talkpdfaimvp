-- Add RLS policies to user_referrals_safe view
-- This view is a sanitized version of referrals data, should match underlying table access patterns

-- Enable RLS on the view (views can have RLS in PostgreSQL)
ALTER VIEW public.user_referrals_safe SET (security_invoker = true, security_barrier = true);

-- Grant SELECT only to authenticated users (not anon)
REVOKE ALL ON public.user_referrals_safe FROM anon;
GRANT SELECT ON public.user_referrals_safe TO authenticated;