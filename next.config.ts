import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep serverless functions under 250 MB: do not bundle public/geojson or public/data.
  // API routes load these at runtime via fetch from the app's own URL.
  experimental: {
    outputFileTracingExcludes: {
      "/api/state/[abbrev]/policy-proposal": [
        "./public/geojson/**",
        "./public/data/**",
      ],
      "/api/tract/[id]": [
        "./public/geojson/**",
        "./public/data/**",
      ],
      "/api/tract/[id]/policy-proposal": [
        "./public/geojson/**",
        "./public/data/**",
      ],
    },
  },
};

export default nextConfig;
