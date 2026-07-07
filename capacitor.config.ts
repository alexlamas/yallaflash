import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

// Native shell for the V2 tutor experience. The web assets come from
// `npm run build:native` (a static export in out/); the JSON API stays on
// Vercel and is called cross-origin with a bearer token.
const config: CapacitorConfig = {
  appId: "com.yallaflash.app",
  appName: "Yalla Flash",
  webDir: "out",
  backgroundColor: "#ffffff",
  ios: {
    // Long-press link previews are a browser affordance, not an app one.
    allowsLinkPreview: false,
  },
  plugins: {
    Keyboard: {
      // Shrink the webview when the keyboard shows so the chat composer
      // rides above it (the 100dvh layouts track the resize).
      resize: KeyboardResize.Native,
    },
    SplashScreen: {
      backgroundColor: "#ffffff",
      // NativeInit hides the splash once the UI has painted -- a fixed
      // duration either drags or drops the user on a half-booted page.
      launchAutoHide: false,
      launchShowDuration: 0,
      showSpinner: false,
    },
  },
};

export default config;
