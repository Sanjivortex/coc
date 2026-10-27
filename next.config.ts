import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Game images are pre-resized WebP (scripts/build-gamedata.mjs) and league/badge icons are tiny,
    // so skip the optimizer: faster, and no image-optimization quota on hosts like Vercel.
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
