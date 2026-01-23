-- Enable realtime for documents table to sync deletions across components
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;