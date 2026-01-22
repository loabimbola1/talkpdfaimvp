-- Add campus verification columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS campus_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS campus_email text;

-- Create index for campus verification lookups
CREATE INDEX IF NOT EXISTS idx_profiles_campus_verified ON public.profiles (campus_verified);

-- Enable pg_cron extension if not already enabled (for weekly digest scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Enable pg_net extension for making HTTP requests from cron (for weekly digest)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;