import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "prompt",

      includeAssets: ["icons/apple-touch-icon.png"],

      manifest: {
        name: "Barangay Natumolan Management Information System",
        short_name: "Natumolan MIS",
        description:
          "Barangay Natumolan, Tagoloan, Misamis Oriental — resident register, " +
          "certificates, and services.",
        lang: "en-PH",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#5b21b6",

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: [
          "**/*.{js,css,html,svg,png,jpg,ico,woff,woff2}",
        ],

        globIgnores: [
          "icons/icon-512.png",
          "icons/maskable-512.png",
        ],

        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,

        navigateFallback: "index.html",

        navigateFallbackDenylist: [
          /\/api\//,
          /\/storage\//,
        ],

        clientsClaim: true,
        skipWaiting: false,

        runtimeCaching: [
          {
            urlPattern: /\/storage\/certificate-photos\//,
            handler: "CacheFirst",

            options: {
              cacheName: "certificate-photos",

              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 180,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          {
            urlPattern:
              /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,

            handler: "CacheFirst",

            options: {
              cacheName: "google-fonts",

              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },

              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],

  /*
   * Vite Development Server
   *
   * Configuration for VS Code Port Forwarding / Dev Tunnel.
   *
   * The previous setup was returning 504 errors when the
   * forwarded URL requested Vite source modules such as:
   *
   *   About.tsx
   *   Button.tsx
   *   Modal.tsx
   *   swiper_react.js
   *   hero SVG files
   *   CSS modules
   *
   * HMR is temporarily disabled to remove the WebSocket
   * connection from the Dev Tunnel troubleshooting.
   */
  server: {
    host: "0.0.0.0",

    port: 5173,

    strictPort: true,

    allowedHosts: true,

    hmr: false,

    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/storage": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },

  /*
   * Production build configuration
   */
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: [
            "react",
            "react-dom",
            "react-router-dom",
          ],

          motion: [
            "framer-motion",
          ],

          swiper: [
            "swiper",
            "swiper/react",
          ],

          charts: [
            "recharts",
          ],
        },
      },
    },
  },
});