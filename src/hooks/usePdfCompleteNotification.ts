import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePdfCompleteNotification() {
  const notifyPdfComplete = useCallback(async (documentTitle: string) => {
    // Check if notifications are enabled
    const enabled = localStorage.getItem("talkpdf-notifications-enabled") === "true";
    
    if (!enabled || Notification.permission !== "granted") {
      return;
    }

    try {
      // Show browser notification
      new Notification("PDF Ready! 🎉", {
        body: `Your document "${documentTitle}" has been processed and is ready to listen.`,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: "pdf-complete",
        requireInteraction: false,
      });
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }, []);

  const subscribeToDocumentUpdates = useCallback((userId: string, onComplete: (doc: any) => void) => {
    const channel = supabase
      .channel("document-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newDoc = payload.new;
          const oldDoc = payload.old;
          
          // Check if document just became ready
          if (oldDoc.status !== "ready" && newDoc.status === "ready") {
            onComplete(newDoc);
            
            // Also show notification
            const enabled = localStorage.getItem("talkpdf-notifications-enabled") === "true";
            if (enabled && Notification.permission === "granted") {
              try {
                new Notification("PDF Ready! 🎉", {
                  body: `"${newDoc.title}" is ready to listen.`,
                  icon: "/favicon.png",
                  tag: "pdf-complete-" + newDoc.id,
                });
              } catch (e) {
                console.log("Notification error:", e);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    notifyPdfComplete,
    subscribeToDocumentUpdates,
  };
}
