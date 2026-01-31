-- Add ai_questions_asked column to daily_usage_summary table for tracking Read & Learn questions
ALTER TABLE public.daily_usage_summary 
ADD COLUMN ai_questions_asked INTEGER DEFAULT 0;

-- Update the trigger function to also handle ai_question action type
CREATE OR REPLACE FUNCTION public.apply_usage_tracking_to_daily_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  usage_date date;
BEGIN
  usage_date := (NEW.created_at AT TIME ZONE 'UTC')::date;

  INSERT INTO public.daily_usage_summary (
    user_id,
    date,
    pdfs_uploaded,
    audio_minutes_used,
    explain_back_count,
    ai_questions_asked
  )
  VALUES (
    NEW.user_id,
    usage_date,
    0,
    0,
    0,
    0
  )
  ON CONFLICT (user_id, date) DO NOTHING;

  IF NEW.action_type = 'pdf_upload' THEN
    UPDATE public.daily_usage_summary
      SET pdfs_uploaded = COALESCE(pdfs_uploaded, 0) + 1,
          updated_at = now()
    WHERE user_id = NEW.user_id AND date = usage_date;
  ELSIF NEW.action_type = 'audio_conversion' THEN
    UPDATE public.daily_usage_summary
      SET audio_minutes_used = COALESCE(audio_minutes_used, 0) + COALESCE(NEW.audio_minutes_used, 0),
          updated_at = now()
    WHERE user_id = NEW.user_id AND date = usage_date;
  ELSIF NEW.action_type = 'explain_back' THEN
    UPDATE public.daily_usage_summary
      SET explain_back_count = COALESCE(explain_back_count, 0) + 1,
          updated_at = now()
    WHERE user_id = NEW.user_id AND date = usage_date;
  ELSIF NEW.action_type = 'ai_question' THEN
    UPDATE public.daily_usage_summary
      SET ai_questions_asked = COALESCE(ai_questions_asked, 0) + 1,
          updated_at = now()
    WHERE user_id = NEW.user_id AND date = usage_date;
  END IF;

  RETURN NEW;
END;
$function$;