-- Add unique constraint on study_group_members for group_id + user_id
-- This is needed for upsert operations to work correctly
ALTER TABLE public.study_group_members 
ADD CONSTRAINT study_group_members_group_user_unique 
UNIQUE (group_id, user_id);