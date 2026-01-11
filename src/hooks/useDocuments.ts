import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  title: string;
  file_name: string;
  status: string;
  audio_url: string | null;
  audio_language: string | null;
  audio_duration_seconds: number | null;
  explain_back_score: number | null;
  last_studied_at: string | null;
  created_at: string;
  study_prompts?: Array<{ topic: string; prompt: string }> | null;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Transform study_prompts to correct type
      const typedDocs: Document[] = (data || []).map((doc) => ({
        ...doc,
        study_prompts: doc.study_prompts as Array<{ topic: string; prompt: string }> | null,
      }));

      setDocuments(typedDocs);
      setError(null);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("documents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
        },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  const getReadyDocuments = useCallback(() => {
    return documents.filter((doc) => doc.status === "ready");
  }, [documents]);

  const getDocumentsWithAudio = useCallback(() => {
    return documents.filter((doc) => doc.audio_url !== null);
  }, [documents]);

  const getDocumentById = useCallback(
    (id: string) => {
      return documents.find((doc) => doc.id === id);
    },
    [documents]
  );

  const deleteDocument = async (id: string) => {
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
    getReadyDocuments,
    getDocumentsWithAudio,
    getDocumentById,
    deleteDocument,
  };
}
