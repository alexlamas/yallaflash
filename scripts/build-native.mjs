#!/usr/bin/env node
// Builds the static export that the Capacitor native app bundles (out/).
//
// Next.js can't statically export API routes, middleware, or the
// server-rendered SEO pages, and `output: "export"` has no per-route opt-out
// -- so those trees are moved aside for the duration of the build and always
// restored afterwards. They keep running on Vercel; the app calls the API
// cross-origin with a bearer token (see app/v2/lib/api.ts).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STASH = path.join(ROOT, ".native-stash");

const SERVER_ONLY = [
  "middleware.ts",
  "app/api",
  "app/packs",
  "app/songs",
  "app/sitemap.ts",
  "app/robots.ts",
  "app/(main)/admin",
];

// Where the packaged app reaches the JSON API (and its Anthropic-backed
// endpoints). Override for a preview deployment or local dev server.
// Must be the canonical www host: the apex 307-redirects to it, and CORS
// preflights refuse to follow redirects ("Load failed" on every call).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://www.yallaflash.com";

if (fs.existsSync(STASH)) {
  console.error(
    `${STASH} exists -- a previous build was interrupted before restoring. ` +
      `Move its contents back into place (or delete it if already restored), then re-run.`
  );
  process.exit(1);
}

function move(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

const moved = [];
let failed = false;
try {
  for (const rel of SERVER_ONLY) {
    const from = path.join(ROOT, rel);
    if (!fs.existsSync(from)) continue;
    move(from, path.join(STASH, rel));
    moved.push(rel);
  }

  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_OUTPUT: "export",
      NEXT_PUBLIC_APP_MODE: "native",
      NEXT_PUBLIC_API_BASE: API_BASE,
    },
  });
} catch (error) {
  failed = true;
  console.error(error.message ?? error);
} finally {
  for (const rel of moved) {
    move(path.join(STASH, rel), path.join(ROOT, rel));
  }
  fs.rmSync(STASH, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`\nStatic export written to out/ (API base: ${API_BASE}).`);
console.log("Next: npx cap sync, then open the platform project (npx cap open ios).");
