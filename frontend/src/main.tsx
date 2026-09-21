import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";
import { registerServiceWorker } from "./shared/offline/serviceWorker";
import { reportLostRequests } from "./shared/offline/reportLostRequests";

/*
 * Before React mounts, so the worker is installing while the app boots
 * rather than after the first render has already gone to the network.
 */
registerServiceWorker();

/* A request that never left the building is said once, not thrown at the console. */
reportLostRequests();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
