import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Version-based cache invalidation to prevent stale data after deployments
const APP_VERSION = "2.2.0";
const cachedVersion = localStorage.getItem("app_version");

if (cachedVersion !== APP_VERSION) {
  // Clear service worker caches to prevent stale API responses
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        if (cacheName.startsWith('supabase-') || cacheName.startsWith('workbox-')) {
          caches.delete(cacheName);
          console.log(`Cleared cache: ${cacheName}`);
        }
      });
    });
  }

  // Clear stale localStorage caches that may cause data inconsistency
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith("sb-") || // Supabase auth tokens
      key.includes("-auth-token") ||
      key.startsWith("REACT_QUERY") // React Query cache keys
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  localStorage.setItem("app_version", APP_VERSION);
  
  // Only reload if we actually cleared something or upgraded
  if ((keysToRemove.length > 0 || cachedVersion !== null) && cachedVersion !== null) {
    console.log(`App updated to v${APP_VERSION}, cleared ${keysToRemove.length} cached items`);
    window.location.reload();
  }
}

createRoot(document.getElementById("root")!).render(<App />);
