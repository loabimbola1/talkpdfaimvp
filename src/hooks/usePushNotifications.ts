import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    const checkSupport = async () => {
      // Check if notifications are supported
      const notificationSupported = "Notification" in window;
      
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

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported on this device");
      return false;
    }

    try {
      // Check if permission was already denied
      if (Notification.permission === "denied") {
        toast.error(
          "Notifications are blocked. Please enable them in your browser settings by clicking the lock icon in the address bar.",
          { duration: 6000 }
        );
        return false;
      }

      // Request permission if not already granted
      let permission: NotificationPermission = Notification.permission;
      if (permission === "default") {
        console.log("Requesting notification permission...");
        permission = await Notification.requestPermission();
        console.log("Permission result:", permission);
      }
      setPermissionState(permission);
      
      if (permission !== "granted") {
        toast.error(
          "Please click 'Allow' when prompted to enable study reminders",
          { duration: 5000 }
        );
        return false;
      }

      // Try to use Push API with VitePWA service worker if available
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          // Wait for VitePWA's service worker to be ready
          // VitePWA registers the service worker automatically
          console.log("Waiting for service worker to be ready...");
          const registration = await navigator.serviceWorker.ready;
          console.log("Service worker ready:", registration.scope);
          
          // We don't need actual push subscription for local notifications
          // The VitePWA service worker handles caching, but we use local Notification API
          localStorage.setItem("talkpdf-sw-active", "true");
        } catch (swError) {
          console.log("Service worker not available, using local notifications only:", swError);
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
      localStorage.removeItem("talkpdf-notifications-enabled");
      localStorage.removeItem("talkpdf-sw-active");
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
        // Create notification using the Notification API directly
        const notification = new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: "study-reminder",
          requireInteraction: false,
          silent: false,
        });
        
        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
        console.log("Notification scheduled successfully");
      } catch (error) {
        console.error("Error showing notification:", error);
        // Fallback: try using service worker if available
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              icon: "/favicon.png",
              badge: "/favicon.png",
              tag: "study-reminder",
            }).catch(console.error);
          }).catch(console.error);
        }
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
