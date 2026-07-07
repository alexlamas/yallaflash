"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The Capacitor app serves its assets from disk -- they're offline by
    // definition, and service workers don't work reliably in WKWebView.
    if (process.env.NEXT_PUBLIC_APP_MODE === "native") return;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      };
      // The load event may have already fired by the time hydration runs
      // this effect, in which case the listener would never fire.
      if (document.readyState === "complete") {
        register();
        return;
      }
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}