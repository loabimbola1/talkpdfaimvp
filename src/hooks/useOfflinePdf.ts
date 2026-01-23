import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CachedPdf {
  documentId: string;
  documentTitle: string;
  pdfUrl: string;
  cachedAt: number;
  size?: number;
}

const CACHE_NAME = "talkpdf-pdf-cache";
const CACHE_INDEX_KEY = "talkpdf-pdf-index";
const MAX_CACHE_SIZE_MB = 200; // Maximum cache size in MB for PDFs

export function useOfflinePdf() {
  const [cachedPdfs, setCachedPdfs] = useState<CachedPdf[]>([]);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    loadCacheIndex();
  }, []);

  const loadCacheIndex = useCallback(async () => {
    try {
      const index = localStorage.getItem(CACHE_INDEX_KEY);
      if (index) {
        const parsed: CachedPdf[] = JSON.parse(index);
        setCachedPdfs(parsed);

        const totalSize = parsed.reduce((acc, item) => acc + (item.size || 0), 0);
        setCacheSize(totalSize);
      }
    } catch (error) {
      console.error("Error loading PDF cache index:", error);
    }
  }, []);

  const saveCacheIndex = useCallback((items: CachedPdf[]) => {
    try {
      localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(items));
      setCachedPdfs(items);
    } catch (error) {
      console.error("Error saving PDF cache index:", error);
    }
  }, []);

  const downloadPdfForOffline = useCallback(async (
    documentId: string,
    documentTitle: string,
    pdfStoragePath: string
  ): Promise<boolean> => {
    if (!("caches" in window)) {
      toast.error("Offline mode is not supported in this browser");
      return false;
    }

    // Check if already cached
    if (cachedPdfs.some(c => c.documentId === documentId)) {
      toast.info("This PDF is already available offline");
      return true;
    }

    setIsDownloading(documentId);

    try {
      // Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from("talkpdf")
        .createSignedUrl(pdfStoragePath, 3600);

      if (urlError || !urlData?.signedUrl) {
        throw new Error("Failed to get PDF URL");
      }

      // Fetch the PDF file
      const response = await fetch(urlData.signedUrl);
      if (!response.ok) throw new Error("Failed to download PDF");

      const blob = await response.blob();
      const sizeInMB = blob.size / (1024 * 1024);

      // Check if we have space
      const currentSize = cacheSize / (1024 * 1024);
      if (currentSize + sizeInMB > MAX_CACHE_SIZE_MB) {
        toast.error(`Not enough cache space. Clear some offline PDFs first. (${Math.round(currentSize)}MB / ${MAX_CACHE_SIZE_MB}MB used)`);
        return false;
      }

      // Open cache and store the PDF
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-pdf/${documentId}`;

      const cacheResponse = new Response(blob, {
        headers: {
          "Content-Type": blob.type || "application/pdf",
          "Content-Length": blob.size.toString(),
        },
      });

      await cache.put(cacheKey, cacheResponse);

      // Update index
      const newItem: CachedPdf = {
        documentId,
        documentTitle,
        pdfUrl: cacheKey,
        cachedAt: Date.now(),
        size: blob.size,
      };

      const updatedItems = [...cachedPdfs, newItem];
      saveCacheIndex(updatedItems);
      setCacheSize(prev => prev + blob.size);

      toast.success(`"${documentTitle}" PDF is now available offline!`);
      return true;
    } catch (error) {
      console.error("Error downloading PDF for offline:", error);
      toast.error("Failed to download PDF for offline use");
      return false;
    } finally {
      setIsDownloading(null);
    }
  }, [cachedPdfs, cacheSize, saveCacheIndex]);

  const getOfflinePdfUrl = useCallback(async (documentId: string): Promise<string | null> => {
    if (!("caches" in window)) return null;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-pdf/${documentId}`;
      const response = await cache.match(cacheKey);

      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      console.error("Error getting offline PDF:", error);
      return null;
    }
  }, []);

  const removeOfflinePdf = useCallback(async (documentId: string): Promise<boolean> => {
    if (!("caches" in window)) return false;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/offline-pdf/${documentId}`;
      await cache.delete(cacheKey);

      const removedItem = cachedPdfs.find(c => c.documentId === documentId);
      const updatedItems = cachedPdfs.filter(c => c.documentId !== documentId);
      saveCacheIndex(updatedItems);

      if (removedItem?.size) {
        setCacheSize(prev => prev - removedItem.size!);
      }

      return true;
    } catch (error) {
      console.error("Error removing offline PDF:", error);
      return false;
    }
  }, [cachedPdfs, saveCacheIndex]);

  const clearAllOfflinePdfs = useCallback(async (): Promise<boolean> => {
    if (!("caches" in window)) return false;

    try {
      await caches.delete(CACHE_NAME);
      saveCacheIndex([]);
      setCacheSize(0);
      toast.success("All offline PDFs cleared");
      return true;
    } catch (error) {
      console.error("Error clearing offline PDF cache:", error);
      toast.error("Failed to clear offline PDFs");
      return false;
    }
  }, [saveCacheIndex]);

  const isPdfCached = useCallback((documentId: string): boolean => {
    return cachedPdfs.some(c => c.documentId === documentId);
  }, [cachedPdfs]);

  return {
    cachedPdfs,
    isDownloading,
    cacheSize,
    maxCacheSize: MAX_CACHE_SIZE_MB * 1024 * 1024,
    downloadPdfForOffline,
    getOfflinePdfUrl,
    removeOfflinePdf,
    clearAllOfflinePdfs,
    isPdfCached,
  };
}
