import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    /*
     * Offline, for the barangay's own offices.
     *
     * Natumolan loses its line often enough that "come back when the
     * internet is up" is not an answer anybody at the counter can give to
     * somebody standing in front of them. The offices have to keep working.
     *
     * WHAT THIS PLUGIN DOES AND DOES NOT DO. It precaches the app SHELL —
     * the HTML, the JavaScript, the CSS, the fonts — so the page still
     * loads with no network. It does NOT cache the barangay's data; that is
     * a separate store with its own rules, because a resident record is not
     * a stylesheet and must not be served stale without anybody being told.
     *
     * The shell is cached for everyone, residents included. That is only a
     * faster load on a bad line and costs nothing. The offline CAPABILITY —
     * the data, the queue, signing in with no server — is gated to office
     * accounts, in the app rather than here.
     */
    VitePWA({
      /*
       * Updates apply on the next visit rather than reloading under
       * somebody's hands. A clerk halfway through a certificate must not
       * have the page replaced beneath them because a deploy landed.
       */
      registerType: "prompt",

      includeAssets: ["icons/apple-touch-icon.png"],

      manifest: {
        name: "Barangay Natumolan Management Information System",
        short_name: "Natumolan MIS",
        description:
          "Barangay Natumolan, Tagoloan, Misamis Oriental — resident register, "
          + "certificates, and services.",
        lang: "en-PH",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        /* The system's own primary, so the title bar matches the app. */
        theme_color: "#5b21b6",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          /*
           * Separate files, not the same ones relabelled. A launcher crops a
           * maskable icon to its own shape, so these carry a wider margin —
           * reusing the tight ones would cut the seal's edge off.
           */
          { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: {
        /*
         * Everything the shell is made of. The chunks are content-hashed, so
         * a stale one can never be served for a new build.
         */
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,ico,woff,woff2}"],

        /*
         * The register is 20,000 residents and the charts bundle is large.
         * The default 2 MiB cap would silently skip the biggest chunks and
         * the app would look cached until the one file it needs is missing.
         */
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,

        /*
         * Any address the router owns falls back to the shell, so a reload
         * on /population/rbim offline still opens the app rather than a
         * browser error.
         *
         * The API is excluded. It is not the router's, and answering an API
         * call with an HTML page turns "you are offline" into a JSON parse
         * error three layers down.
         */
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/storage\//],

        /* A deploy's new worker takes over at once instead of waiting for
           every tab to close — offices leave tabs open for days. */
        clientsClaim: true,
        skipWaiting: false,

        runtimeCaching: [
          {
            /*
             * Counter photographs, kept once they have been seen.
             *
             * A photo attached while the line was up is a file on the server,
             * not part of the app, so the precache does not have it. Printed
             * later during an outage, the certificate came out with an empty
             * photo box. Cached the first time the office views it, it prints
             * with no line like everything else on the sheet.
             *
             * CacheFirst is safe here: a photograph is never edited in place —
             * a new one gets a new random file name — so a cached copy can
             * never be a stale version of the same address.
             */
            urlPattern: /\/storage\/certificate-photos\//,
            handler: "CacheFirst",
            options: {
              cacheName: "certificate-photos",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /*
             * Google's fonts, which the print templates depend on. Without
             * this the certificate renders in a fallback face offline —
             * still correct, but not the paper the barangay signs.
             */
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        /*
         * Off in development on purpose. A service worker serving yesterday's
         * bundle while somebody edits a file is a whole afternoon lost to a
         * bug that is not in the code — this project has already spent one
         * on a stale Vite module.
         */
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Big libraries in their own chunks so browsers keep them cached
        // across app updates (only the small app chunk re-downloads).
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          swiper: ["swiper", "swiper/react"],
          charts: ["recharts"],
        },
      },
    },
  },
});
