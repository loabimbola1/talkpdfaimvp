import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSupport = async () => {
      const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);

      if (supported) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
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
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Please allow notifications to receive study reminders");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to user's profile (for now just store locally)
      localStorage.setItem("talkpdf-push-subscription", JSON.stringify(subscription.toJSON()));
      
      setIsSubscribed(true);
      toast.success("Push notifications enabled! You'll receive study reminders.");
      return true;
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toast.error("Failed to enable notifications");
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        localStorage.removeItem("talkpdf-push-subscription");
        setIsSubscribed(false);
        toast.success("Push notifications disabled");
      }
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error("Failed to disable notifications");
    }
  }, []);

  // Schedule local notification reminder
  const scheduleStudyReminder = useCallback(async (title: string, body: string, delay: number = 0) => {
    if (!isSupported || !isSubscribed) return;

    if (Notification.permission === "granted") {
      setTimeout(() => {
        new Notification(title, {
          body,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: "study-reminder",
          requireInteraction: true,
        });
      }, delay);
    }
  }, [isSupported, isSubscribed]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    scheduleStudyReminder,
  };
}
