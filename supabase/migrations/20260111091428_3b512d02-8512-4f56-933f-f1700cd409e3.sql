-- Create study_groups table for students to form groups
CREATE TABLE public.study_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create study_group_members table for group membership
CREATE TABLE public.study_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create spaced_repetition table for tracking concept mastery and scheduling reviews
CREATE TABLE public.spaced_repetition (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  concept_index INTEGER NOT NULL DEFAULT 0,
  concept_title TEXT NOT NULL,
  easiness_factor NUMERIC NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  last_review_date TIMESTAMP WITH TIME ZONE,
  next_review_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id, concept_index)
);

-- Create micro_lesson_progress table for tracking lesson progress with audio
CREATE TABLE public.micro_lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  concept_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed')),
  score INTEGER,
  audio_url TEXT,
  ai_explanation TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id, concept_index)
);

-- Enable RLS on all tables
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaced_repetition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS for study_groups
CREATE POLICY "Users can view groups they are members of"
ON public.study_groups FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.study_group_members 
    WHERE study_group_members.group_id = study_groups.id 
    AND study_group_members.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Users can create study groups"
ON public.study_groups FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group admins can update groups"
ON public.study_groups FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.study_group_members 
    WHERE study_group_members.group_id = study_groups.id 
    AND study_group_members.user_id = auth.uid()
    AND study_group_members.role = 'admin'
  )
);

CREATE POLICY "Group creators can delete groups"
ON public.study_groups FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- RLS for study_group_members
CREATE POLICY "Users can view members of their groups"
ON public.study_group_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.study_group_members AS sgm
    WHERE sgm.group_id = study_group_members.group_id 
    AND sgm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join groups"
ON public.study_group_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Group admins can manage members"
ON public.study_group_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.study_group_members AS sgm
    WHERE sgm.group_id = study_group_members.group_id 
    AND sgm.user_id = auth.uid()
    AND sgm.role = 'admin'
  )
);

-- RLS for spaced_repetition
CREATE POLICY "Users can view their own spaced repetition data"
ON public.spaced_repetition FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own spaced repetition data"
ON public.spaced_repetition FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spaced repetition data"
ON public.spaced_repetition FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spaced repetition data"
ON public.spaced_repetition FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- RLS for micro_lesson_progress
CREATE POLICY "Users can view their own micro lesson progress"
ON public.micro_lesson_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own micro lesson progress"
ON public.micro_lesson_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own micro lesson progress"
ON public.micro_lesson_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own micro lesson progress"
ON public.micro_lesson_progress FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_study_groups_updated_at
  BEFORE UPDATE ON public.study_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spaced_repetition_updated_at
  BEFORE UPDATE ON public.spaced_repetition
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_micro_lesson_progress_updated_at
  BEFORE UPDATE ON public.micro_lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();