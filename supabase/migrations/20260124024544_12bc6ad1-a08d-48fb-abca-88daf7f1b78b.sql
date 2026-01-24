-- Add tts_metadata column to documents table for debug info
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS tts_metadata jsonb DEFAULT '{}';

COMMENT ON COLUMN public.documents.tts_metadata IS 
'Stores TTS debug info: provider used, translation status, failed providers, audio stats';

-- Create index for efficient querying of TTS provider stats
CREATE INDEX IF NOT EXISTS idx_documents_tts_metadata_provider 
ON public.documents ((tts_metadata->>'tts_provider'));

-- Add RLS policy for admins to view all documents (for analytics)
CREATE POLICY "Admins can view all document metadata" 
ON public.documents 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));