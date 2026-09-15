/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Swiper ships these style entries as raw CSS without type declarations.
declare module "swiper/css";
declare module "swiper/css/*";
