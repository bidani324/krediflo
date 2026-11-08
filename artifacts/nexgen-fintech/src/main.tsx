import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

/* ─── Progressive Web App: Service Worker Registration ──────────────────────
 * Registered after the page has fully loaded so it never blocks the initial
 * render. Uses BASE_URL (set by Vite from BASE_PATH env var) so the SW scope
 * always matches the app's deployment root, whether at "/" or a sub-path.
 * ─────────────────────────────────────────────────────────────────────────── */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Vite replaces import.meta.env.BASE_URL with the actual base path at build time
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    const swScope = import.meta.env.BASE_URL;

    navigator.serviceWorker
      .register(swPath, { scope: swScope })
      .then((registration) => {
        if (import.meta.env.DEV) {
          console.log(
            "[Krediflo PWA] Service Worker registered successfully. Scope:",
            registration.scope,
          );
        }

        // Listen for a new SW waiting to take over
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // A new version is cached and ready — could show an "Update available" toast here
              if (import.meta.env.DEV) {
                console.log(
                  "[Krediflo PWA] New version available. Refresh to update.",
                );
              }
            }
          });
        });
      })
      .catch((err) => {
        console.error("[Krediflo PWA] Service Worker registration failed:", err);
      });

    // When the active SW changes (e.g. after skipWaiting), reload to pick up new assets
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
