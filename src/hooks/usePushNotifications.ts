import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// For local development, we'll use a placeholder VAPID key
// In production, you'd generate real VAPID keys
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    const checkSupport = async () => {
      // Check if notifications are supported
      const notificationSupported = "Notification" in window;
      const serviceWorkerSupported = "serviceWorker" in navigator;
      
      setIsSupported(notificationSupported);

      if (notificationSupported) {
        setPermissionState(Notification.permission);
        
        // Check if already subscribed (from localStorage)
        const savedSubscription = localStorage.getItem("talkpdf-notifications-enabled");
        setIsSubscribed(savedSubscription === "true" && Notification.permission === "granted");
      }
      
      setIsLoading(false);
    };

    checkSupport();
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported on this device");
      return false;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission !== "granted") {
        toast.error("Please allow notifications to receive study reminders");
        return false;
      }

      // Try to subscribe via service worker if available
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
          localStorage.setItem("talkpdf-push-subscription", JSON.stringify(subscription.toJSON()));
        } catch (pushError) {
          console.log("Push subscription not available, using local notifications only");
        }
      }
      
      // Mark as subscribed (for local notifications at minimum)
      localStorage.setItem("talkpdf-notifications-enabled", "true");
      setIsSubscribed(true);
      toast.success("Notifications enabled! You'll receive study reminders.");
      return true;
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      toast.error("Failed to enable notifications. Please try again.");
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      // Try to unsubscribe from push if available
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        } catch (error) {
          console.log("Push unsubscribe error (continuing):", error);
        }
      }
      
      localStorage.removeItem("talkpdf-notifications-enabled");
      localStorage.removeItem("talkpdf-push-subscription");
      setIsSubscribed(false);
      toast.success("Notifications disabled");
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable notifications");
    }
  }, []);

  // Schedule local notification reminder
  const scheduleStudyReminder = useCallback(async (title: string, body: string, delay: number = 0) => {
    if (!isSupported || !isSubscribed) {
      console.log("Cannot schedule reminder: not supported or not subscribed");
      return;
    }

    if (Notification.permission !== "granted") {
      console.log("Cannot schedule reminder: permission not granted");
      return;
    }

    setTimeout(() => {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: "study-reminder",
          requireInteraction: true,
        });
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    }, delay);
  }, [isSupported, isSubscribed]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permissionState,
    subscribe,
    unsubscribe,
    scheduleStudyReminder,
  };
}
