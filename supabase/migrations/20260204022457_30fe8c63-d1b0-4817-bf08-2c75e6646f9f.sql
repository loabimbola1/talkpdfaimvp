-- Add page_contents column to documents table for page-level navigation
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS page_contents JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.documents.page_contents IS 
'Page-by-page text content: [{"page": 1, "text": "...", "chapter": "optional"}, ...]';

-- Enable realtime for usage sync across devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_usage_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_tracking;