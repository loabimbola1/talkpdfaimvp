import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt", "logo.png"],
      manifest: {
        name: "TalkPDF AI - Interactive Learning",
        short_name: "TalkPDF AI",
        description: "AI-powered learning assistant that converts PDFs into interactive audio tutors in Nigerian languages",
        theme_color: "#10b981",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/favicon.png",
            sizes: "64x64",
            type: "image/png"
          }
        ],
        categories: ["education", "productivity"],
        lang: "en-NG",
        dir: "ltr"
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            // Cache documents and audio files
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-v2",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache document list API calls - NetworkFirst to prevent stale data
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/documents.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-documents-v2",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 4 // 4 hours instead of 7 days
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache profiles and usage data - NetworkFirst for freshness
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(profiles|daily_usage_summary|usage_tracking).*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-user-data-v2",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              },
              networkTimeoutSeconds: 5,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache other API responses for offline use
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-v2",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 4 // 4 hours
              },
              networkTimeoutSeconds: 8,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
        }
      }
    },
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
