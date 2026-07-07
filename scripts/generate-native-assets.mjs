#!/usr/bin/env node
// Generates the iOS/Android app icons and splash screens from the pomegranate
// logo (public/logo.svg), writing directly into the committed native projects.
// Replacement for `@capacitor/assets generate` (whose pinned sharp doesn't
// install everywhere). Re-run after changing the logo.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const LOGO = path.join(ROOT, "public", "logo.svg");
const BG = "#ffffff"; // matches android ic_launcher_background

// One high-res raster of the logo, composited down for every target.
const logoMaster = await sharp(LOGO, { density: 300 }).resize(2048, 2048).png().toBuffer();

async function logoAt(size) {
  return sharp(logoMaster).resize(size, size).png().toBuffer();
}

// Solid background with the logo centered at `scale` of the canvas.
async function onBackground(width, height, scale, background = BG) {
  const logoSize = Math.round(Math.min(width, height) * scale);
  return sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: await logoAt(logoSize) }])
    .png()
    .toBuffer();
}

async function write(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  console.log("wrote", path.relative(ROOT, file));
}

function circleMask(size) {
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );
}

// --- iOS ---
const iosAssets = path.join(ROOT, "ios", "App", "App", "Assets.xcassets");
await write(
  path.join(iosAssets, "AppIcon.appiconset", "AppIcon-512@2x.png"),
  await onBackground(1024, 1024, 0.68)
);
const iosSplash = await onBackground(2732, 2732, 0.22);
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await write(path.join(iosAssets, "Splash.imageset", name), iosSplash);
}

// --- Android launcher icons ---
const res = path.join(ROOT, "android", "app", "src", "main", "res");
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(DENSITIES)) {
  const square = await onBackground(size, size, 0.72);
  await write(path.join(res, `mipmap-${density}`, "ic_launcher.png"), square);
  const round = await sharp(square)
    .composite([{ input: circleMask(size), blend: "dest-in" }])
    .png()
    .toBuffer();
  await write(path.join(res, `mipmap-${density}`, "ic_launcher_round.png"), round);
  // Adaptive-icon foreground: transparent, logo inside the ~66% safe zone.
  const fgSize = Math.round(size * 2.25); // 108dp foreground per 48dp icon
  const fg = await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: "#00000000" } })
    .composite([{ input: await logoAt(Math.round(fgSize * 0.5)) }])
    .png()
    .toBuffer();
  await write(path.join(res, `mipmap-${density}`, "ic_launcher_foreground.png"), fg);
}

// --- Android splash screens ---
const SPLASH = {
  "drawable": [480, 320],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
};
for (const [dir, [w, h]] of Object.entries(SPLASH)) {
  await write(path.join(res, dir, "splash.png"), await onBackground(w, h, 0.28));
}

console.log("\nDone. Icons + splash screens regenerated from public/logo.svg.");
