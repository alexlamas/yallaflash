"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/app/v2/lib/native";

// Native-shell startup: tags <html> so CSS can target the app (safe-area
// insets), and styles the iOS status bar for the app's light background.
// Renders nothing; a no-op on the website.
export function NativeInit() {
  useEffect(() => {
    if (!isNativeApp) return;
    document.documentElement.classList.add("native-app");
    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Light style = dark text on the app's white background.
        await StatusBar.setStyle({ style: Style.Light });
      } catch {
        // Status bar plugin is iOS/Android only.
      }
    })();
  }, []);

  return null;
}
