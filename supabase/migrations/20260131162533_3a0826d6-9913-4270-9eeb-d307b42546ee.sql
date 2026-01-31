
-- Fix: Recreate user_referrals_safe view to only show user's own referrals
-- and ensure it excludes IP/user_agent tracking data

-- Drop and recreate the user_referrals_safe view with proper user filtering
DROP VIEW IF EXISTS public.user_referrals_safe;

CREATE VIEW public.user_referrals_safe
WITH (security_invoker = true, security_barrier = true) AS
SELECT 
    id,
    referrer_id,
    referred_id,
    credits_awarded,
    created_at,
    completed_at,
    referral_code,
    status
FROM public.referrals
WHERE referrer_id = auth.uid() OR referred_id = auth.uid();

-- Note: The view now explicitly excludes ip_address and user_agent columns
-- and only shows referrals where the current user is either the referrer or referred

-- Grant access to authenticated users only (not anon)
REVOKE ALL ON public.user_referrals_safe FROM anon;
GRANT SELECT ON public.user_referrals_safe TO authenticated;

COMMENT ON VIEW public.user_referrals_safe IS 'Secure view for user referrals that excludes IP addresses and user agent tracking data';
