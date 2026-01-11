-- Create RLS policies for storage.objects to protect user files in talkpdf bucket
-- Users can only access their own files based on the folder structure {user_id}/{document_id}/{filename}

-- Policy: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'talkpdf' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can upload their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'talkpdf' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'talkpdf' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'talkpdf' AND (storage.foldername(name))[1] = auth.uid()::text);