import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineDocuments } from "./useOfflineDocuments";

export interface TTSMetadata {
  tts_provider?: string;
  requested_language?: string;
  translation_applied?: boolean;
  failed_providers?: string[];
  tts_text_length?: number;
  tts_text_preview?: string;
  audio_size_bytes?: number;
  chunks_generated?: number;
  processed_at?: string;
  voice_used?: string;
  file_type?: string;
}

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  status: string;
  audio_url: string | null;
  audio_language: string | null;
  audio_duration_seconds: number | null;
  explain_back_score: number | null;
  last_studied_at: string | null;
  created_at: string;
  study_prompts?: Array<{ topic: string; prompt: string }> | null;
  tts_metadata?: TTSMetadata | null;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isOnline, cacheDocuments, loadFromCache, removeDocumentFromCache } = useOfflineDocuments();

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);

      // Check if offline - try to load from cache
      if (!isOnline) {
        const cached = await loadFromCache();
        if (cached) {
          setDocuments(cached);
          setError("Offline mode - showing cached documents");
          setLoading(false);
          return;
        }
        throw new Error("You're offline and no cached documents available");
      }

      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDocuments([]);
        setError(null);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      // Transform to correct types
      const typedDocs: Document[] = (data || []).map((doc) => ({
        ...doc,
        study_prompts: doc.study_prompts as Array<{ topic: string; prompt: string }> | null,
        tts_metadata: doc.tts_metadata as TTSMetadata | null,
      }));

      setDocuments(typedDocs);
      setError(null);

      // Cache documents for offline use
      await cacheDocuments(typedDocs);
    } catch (err) {
      console.error("Error fetching documents:", err);
      
      // Try to load from cache on error
      const cached = await loadFromCache();
      if (cached) {
        setDocuments(cached);
        setError("Using cached documents");
      } else {
        setError("Failed to load documents");
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline, cacheDocuments, loadFromCache]);

  useEffect(() => {
    // Get current user for filtered subscription
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        fetchDocuments();
        return () => {};
      }

      fetchDocuments();

      // Subscribe to realtime changes filtered by user_id
      const channel = supabase
        .channel(`documents-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "documents",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log("Document change detected:", payload.eventType, payload.new);
            fetchDocuments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setupSubscription().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
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

  const deleteDocument = async (id: string): Promise<boolean> => {
    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("You must be logged in to delete documents");
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    // Remove from local state
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    
    // Remove from offline cache
    await removeDocumentFromCache(id);

    return true;
  };

  return {
    documents,
    loading,
    error,
    isOnline,
    refetch: fetchDocuments,
    getReadyDocuments,
    getDocumentsWithAudio,
    getDocumentById,
    deleteDocument,
  };
}
