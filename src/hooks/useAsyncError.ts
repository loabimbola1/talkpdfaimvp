import { useCallback, useState } from "react";
import { toast } from "sonner";

interface UseAsyncErrorOptions {
  showToast?: boolean;
  toastTitle?: string;
}

export function useAsyncError(options: UseAsyncErrorOptions = {}) {
  const { showToast = true, toastTitle = "Error" } = options;
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      errorMessage?: string
    ): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await asyncFn();
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        
        if (showToast) {
          toast.error(toastTitle, {
            description: errorMessage || error.message,
          });
        }
        
        console.error("Async error:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [showToast, toastTitle]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isLoading,
    execute,
    clearError,
  };
}
