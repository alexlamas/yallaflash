"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The Capacitor app serves its assets from disk -- they're offline by
    // definition, and service workers don't work reliably in WKWebView.
    if (process.env.NEXT_PUBLIC_APP_MODE === "native") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // The SW's cache-first strategy serves stale JS/CSS chunks after dev
    // rebuilds, so skip it in development -- and unregister any service
    // worker left behind from before this guard existed.
    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
        })
        .catch(() => {
        });
    });
  }, []);

  return null;
}