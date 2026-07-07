"use client";

import { useEffect } from "react";
import { hideSplash, isNativeApp } from "@/app/v2/lib/native";

// Native-shell startup: tags <html> so CSS can target the app (safe-area
// insets), and styles the iOS status bar for the app's light background.
// Renders nothing; a no-op on the website.
export function NativeInit() {
  useEffect(() => {
    if (!isNativeApp) return;
    document.documentElement.classList.add("native-app");

    // Native apps don't pinch-zoom their UI; this also stops iOS zooming
    // the page when a focused field slips under 16px.
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Light style = dark text on the app's white background.
        await StatusBar.setStyle({ style: Style.Light });
      } catch {
        // Status bar plugin is iOS/Android only.
      }
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        // The gray "Done" accessory bar over the keyboard is a webview tell.
        await Keyboard.setAccessoryBarVisible({ isVisible: false });
      } catch {
        // Keyboard plugin is iOS/Android only.
      }
    })();

    // Entry screens call hideSplash() once they're on-glass; this timer only
    // backstops a stuck boot so the splash can never strand the user.
    const fallback = setTimeout(hideSplash, 6000);
    return () => clearTimeout(fallback);
  }, []);

  return null;
}
