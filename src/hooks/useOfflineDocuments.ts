import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Document } from "./useDocuments";

const CACHE_KEY_PREFIX = "talkpdf-documents-cache";
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedData {
  documents: Document[];
  cachedAt: number;
  userId: string;
}

export function useOfflineDocuments() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getCacheKey = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return `${CACHE_KEY_PREFIX}-${user.id}`;
    } catch {
      return null;
    }
  }, []);

  const cacheDocuments = useCallback(async (docs: Document[]): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cacheData: CachedData = {
        documents: docs,
        cachedAt: Date.now(),
        userId: user.id,
      };

      localStorage.setItem(
        `${CACHE_KEY_PREFIX}-${user.id}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error("Error caching documents:", error);
    }
  }, []);

  const loadFromCache = useCallback(async (): Promise<Document[] | null> => {
    try {
      const cacheKey = await getCacheKey();
      if (!cacheKey) return null;

      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedData = JSON.parse(cached);

      // Check if cache is expired
      if (Date.now() - parsed.cachedAt > CACHE_EXPIRY_MS) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return parsed.documents;
    } catch (error) {
      console.error("Error loading cached documents:", error);
      return null;
    }
  }, [getCacheKey]);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      const cacheKey = await getCacheKey();
      if (cacheKey) {
        localStorage.removeItem(cacheKey);
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  }, [getCacheKey]);

  const removeDocumentFromCache = useCallback(async (documentId: string): Promise<void> => {
    try {
      const cacheKey = await getCacheKey();
      if (!cacheKey) return;

      const cached = localStorage.getItem(cacheKey);
      if (!cached) return;

      const parsed: CachedData = JSON.parse(cached);
      parsed.documents = parsed.documents.filter(doc => doc.id !== documentId);
      
      localStorage.setItem(cacheKey, JSON.stringify(parsed));
    } catch (error) {
      console.error("Error removing document from cache:", error);
    }
  }, [getCacheKey]);

  const getCacheAge = useCallback(async (): Promise<number | null> => {
    try {
      const cacheKey = await getCacheKey();
      if (!cacheKey) return null;

      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const parsed: CachedData = JSON.parse(cached);
      return Date.now() - parsed.cachedAt;
    } catch {
      return null;
    }
  }, [getCacheKey]);

  return {
    isOnline,
    cacheDocuments,
    loadFromCache,
    clearCache,
    removeDocumentFromCache,
    getCacheAge,
  };
}
