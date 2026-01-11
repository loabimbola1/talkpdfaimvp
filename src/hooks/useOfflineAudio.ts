import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CachedAudio {
  documentId: string;
  documentTitle: string;
  audioUrl: string;
  cachedAt: number;
  size?: number;
}

const CACHE_NAME = "talkpdf-audio-cache";
const CACHE_INDEX_KEY = "talkpdf-audio-index";
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB

export function useOfflineAudio() {
  const [cachedAudios, setCachedAudios] = useState<CachedAudio[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    loadCacheIndex();
  }, []);

  const loadCacheIndex = useCallback(async () => {
    try {
      const index = localStorage.getItem(CACHE_INDEX_KEY);
      if (index) {
        const parsed: CachedAudio[] = JSON.parse(index);
        setCachedAudios(parsed);
        
        // Calculate total size
        const totalSize = parsed.reduce((acc, item) => acc + (item.size || 0), 0);
        setCacheSize(totalSize);
      }
    } catch (error) {
      console.error("Error loading cache index:", error);
    }
  }, []);

  const saveCacheIndex = useCallback((items: CachedAudio[]) => {
    try {
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(items));
      setCachedAudios(items);
    } catch (error) {
      console.error("Error saving cache index:", error);
    }
  }, []);

  const downloadForOffline = useCallback(async (
    documentId: string,
    documentTitle: string,
    audioStoragePath: string
  ): Promise<boolean> => {
    if (!("caches" in window)) {
      toast.error("Offline mode is not supported in this browser");
      return false;
    }

    // Check if already cached
    if (cachedAudios.some(c => c.documentId === documentId)) {
      toast.info("This audio is already available offline");
      return true;
    }

    setIsDownloading(documentId);

    try {
      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from("talkpdf")
        .createSignedUrl(audioStoragePath, 3600);

      if (urlError || !urlData?.signedUrl) {
        throw new Error("Failed to get audio URL");
      }

      // Fetch the audio file
      const response = await fetch(urlData.signedUrl);
      if (!response.ok) throw new Error("Failed to download audio");

      const blob = await response.blob();
      const sizeInMB = blob.size / (1024 * 1024);

      // Check if we have space
      const currentSize = cacheSize / (1024 * 1024);
      if (currentSize + sizeInMB > MAX_CACHE_SIZE_MB) {
        toast.error(`Not enough cache space. Clear some offline audios first. (${Math.round(currentSize)}MB / ${MAX_CACHE_SIZE_MB}MB used)`);
        return false;
      }

      // Open cache and store the audio
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-audio/${documentId}`;
      
      // Create a response with the blob
      const cacheResponse = new Response(blob, {
        headers: {
          "Content-Type": blob.type || "audio/mpeg",
          "Content-Length": blob.size.toString(),
        },
      });

      await cache.put(cacheKey, cacheResponse);

      // Update index
      const newItem: CachedAudio = {
        documentId,
        documentTitle,
        audioUrl: cacheKey,
        cachedAt: Date.now(),
        size: blob.size,
      };

      const updatedItems = [...cachedAudios, newItem];
      saveCacheIndex(updatedItems);
      setCacheSize(prev => prev + blob.size);

      toast.success(`"${documentTitle}" is now available offline!`);
      return true;
    } catch (error) {
      console.error("Error downloading audio for offline:", error);
      toast.error("Failed to download audio for offline use");
      return false;
    } finally {
      setIsDownloading(null);
    }
  }, [cachedAudios, cacheSize, saveCacheIndex]);

  const getOfflineAudioUrl = useCallback(async (documentId: string): Promise<string | null> => {
    if (!("caches" in window)) return null;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-audio/${documentId}`;
      const response = await cache.match(cacheKey);

      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      console.error("Error getting offline audio:", error);
      return null;
    }
  }, []);

  const removeOfflineAudio = useCallback(async (documentId: string): Promise<boolean> => {
    if (!("caches" in window)) return false;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-audio/${documentId}`;
      await cache.delete(cacheKey);

      const removedItem = cachedAudios.find(c => c.documentId === documentId);
      const updatedItems = cachedAudios.filter(c => c.documentId !== documentId);
      saveCacheIndex(updatedItems);
      
      if (removedItem?.size) {
        setCacheSize(prev => prev - removedItem.size!);
      }

      toast.success("Removed from offline storage");
      return true;
    } catch (error) {
      console.error("Error removing offline audio:", error);
      toast.error("Failed to remove offline audio");
      return false;
    }
  }, [cachedAudios, saveCacheIndex]);

  const clearAllOfflineAudio = useCallback(async (): Promise<boolean> => {
    if (!("caches" in window)) return false;

    try {
      await caches.delete(CACHE_NAME);
      saveCacheIndex([]);
      setCacheSize(0);
      toast.success("All offline audios cleared");
      return true;
    } catch (error) {
      console.error("Error clearing offline cache:", error);
      toast.error("Failed to clear offline cache");
      return false;
    }
  }, [saveCacheIndex]);

  const isAudioCached = useCallback((documentId: string): boolean => {
    return cachedAudios.some(c => c.documentId === documentId);
  }, [cachedAudios]);

  return {
    cachedAudios,
    isDownloading,
    cacheSize,
    maxCacheSize: MAX_CACHE_SIZE_MB * 1024 * 1024,
    downloadForOffline,
    getOfflineAudioUrl,
    removeOfflineAudio,
    clearAllOfflineAudio,
    isAudioCached,
  };
}
