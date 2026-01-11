-- Add university field to profiles for campus leaderboard
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS university TEXT;

-- Create quiz_scores table to track quiz performance for leaderboard
CREATE TABLE IF NOT EXISTS public.quiz_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  quiz_type TEXT DEFAULT 'mixed',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quiz_scores
ALTER TABLE public.quiz_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_scores
CREATE POLICY "Users can view their own quiz scores"
ON public.quiz_scores FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz scores"
ON public.quiz_scores FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy to allow viewing quiz scores for leaderboard (aggregated)
CREATE POLICY "Users can view all quiz scores for leaderboard"
ON public.quiz_scores FOR SELECT
TO authenticated
USING (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_scores_user_id ON public.quiz_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_scores_completed_at ON public.quiz_scores(completed_at);
CREATE INDEX IF NOT EXISTS idx_profiles_university ON public.profiles(university);