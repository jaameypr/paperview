import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployments
  output: "standalone",

  // Turbopack config (default in Next.js 16)
  // The canvas alias is not needed with Turbopack because the PDF viewer
  // is loaded client-side only (ssr: false), so pdfjs-dist never runs on the server.
  turbopack: {},

  // Webpack config kept for explicit --webpack builds
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
