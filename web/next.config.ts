import path from "path";
import type { NextConfig } from "next";

// Use the web app directory as tracing root. Setting this to the monorepo root
// (`path.join(__dirname, "..")`) breaks server chunk resolution: webpack-runtime
// then requires `./N.js` next to `.next/server/` while chunks live under `chunks/`.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  /** Proxy API in dev so the browser calls :3000 only (no cross-origin / Safari CORS quirks). */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://127.0.0.1:4000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
