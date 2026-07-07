import type { NextConfig } from "next";

// Set by scripts/build-native.mjs: builds the app as a static export that the
// Capacitor shell bundles and serves locally. API routes and server-rendered
// pages are stashed out of the tree by that script -- they stay on Vercel and
// the app calls them cross-origin (see app/v2/lib/api.ts).
const isNativeExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  // Directory-style paths (chat/index.html) so Capacitor's local web server
  // can resolve deep links without a rewrite layer.
  trailingSlash: isNativeExport,
  ...(isNativeExport ? { output: "export" as const } : {}),
  images: {
    // No image-optimization server in a static export.
    ...(isNativeExport ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fyivbeipfwtogeszgfnd.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
    ],
  },
  // Disable browser caching in development
  async headers() {
    if (process.env.NODE_ENV !== 'development' || isNativeExport) {
      return [];
    }
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
