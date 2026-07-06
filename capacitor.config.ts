import type { CapacitorConfig } from "@capacitor/cli";

// Native shell for the V2 tutor experience. The web assets come from
// `npm run build:native` (a static export in out/); the JSON API stays on
// Vercel and is called cross-origin with a bearer token.
const config: CapacitorConfig = {
  appId: "com.yallaflash.app",
  appName: "Yalla Flash",
  webDir: "out",
};

export default config;
