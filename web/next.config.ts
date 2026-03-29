import path from "path";
import type { NextConfig } from "next";

// Use the web app directory as tracing root. Setting this to the monorepo root
// (`path.join(__dirname, "..")`) breaks server chunk resolution: webpack-runtime
// then requires `./N.js` next to `.next/server/` while chunks live under `chunks/`.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  /**
   * Proxy `/api` to Express. Local default: `server` on :4000.
   * On Vercel: set `API_PROXY_TARGET` to your deployed API origin (e.g. `https://xxx.railway.app`); no
   * Express process runs on Vercel's localhost, so the default would break login with 404/502.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://127.0.0.1:4000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
