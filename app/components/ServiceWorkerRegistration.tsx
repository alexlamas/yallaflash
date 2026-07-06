"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The Capacitor app serves its assets from disk -- they're offline by
    // definition, and service workers don't work reliably in WKWebView.
    if (process.env.NEXT_PUBLIC_APP_MODE === "native") return;
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then(() => {
          })
          .catch(() => {
          });
      });
    }
  }, []);

  return null;
}