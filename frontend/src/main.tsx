import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { registerServiceWorker } from "./shared/offline/serviceWorker";

/*
 * Before React mounts, so the worker is installing while the app boots
 * rather than after the first render has already gone to the network.
 */
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
