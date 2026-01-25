-- Add tracking columns for referral abuse detection
ALTER TABLE public.referrals
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text,
ADD COLUMN IF NOT EXISTS flagged_suspicious boolean DEFAULT false;

-- Create indexes for abuse detection queries
CREATE INDEX IF NOT EXISTS idx_referrals_ip_address ON public.referrals(ip_address);
CREATE INDEX IF NOT EXISTS idx_referrals_completed_at ON public.referrals(completed_at);