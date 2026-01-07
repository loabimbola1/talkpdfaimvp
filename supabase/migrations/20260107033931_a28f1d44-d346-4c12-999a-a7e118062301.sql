-- Create badges table for gamification
CREATE TABLE public.badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  description TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  score INTEGER,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shared_on TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Create policies for badges
CREATE POLICY "Users can view their own badges" 
ON public.badges 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own badges" 
ON public.badges 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own badges" 
ON public.badges 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create index for efficient queries
CREATE INDEX idx_badges_user_id ON public.badges(user_id);
CREATE INDEX idx_badges_earned_at ON public.badges(earned_at DESC);