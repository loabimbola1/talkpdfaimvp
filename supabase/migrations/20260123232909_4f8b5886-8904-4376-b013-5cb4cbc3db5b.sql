-- Add subscription_started_at to track when subscription began (for credit reset)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing paid users to have their subscription_started_at set to their first payment
UPDATE public.profiles p
SET subscription_started_at = (
  SELECT MIN(created_at) 
  FROM public.payments pay 
  WHERE pay.user_id = p.user_id 
  AND pay.status = 'completed'
)
WHERE p.subscription_plan IN ('plus', 'pro')
AND p.subscription_started_at IS NULL;