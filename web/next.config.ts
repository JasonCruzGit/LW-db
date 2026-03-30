import path from "path";
import type { NextConfig } from "next";

// Use the web app directory as tracing root. Setting this to the monorepo root
// (`path.join(__dirname, "..")`) breaks server chunk resolution: webpack-runtime
// then requires `./N.js` next to `.next/server/` while chunks live under `chunks/`.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
