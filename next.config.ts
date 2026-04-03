import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployments
  output: "standalone",

  // Allow LAN access during development (e.g. testing from other devices)
  allowedDevOrigins: ["192.168.40.172"],

  // Required for reverse-proxy / tunnel deployments (Cloudflare Tunnel, Nginx, etc.).
  // Tells Next.js to trust the Host header from the proxy instead of using the
  // internal bind address (HOSTNAME=0.0.0.0) for URL construction and routing.
  // Note: Next.js standalone builds hardcode this to false for non-Vercel deployments,
  // so the Dockerfile also patches the standalone server.js to enable it.
  experimental: {
    trustHostHeader: true,
  } as NextConfig["experimental"],

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
