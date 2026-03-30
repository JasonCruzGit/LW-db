/* Ensures Next.js runtime can require next/dist/compiled/source-map on Vercel. */
const fs = require("fs");
const path = require("path");

function ensureFile(p, contents) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, contents, "utf8");
}

try {
  const nextPkg = require.resolve("next/package.json");
  const nextRoot = path.dirname(nextPkg);
  const target = path.join(nextRoot, "dist", "compiled", "source-map.js");
  ensureFile(
    target,
    `"use strict";\n// Resolve from the repo root so npm workspaces hoisting works.\nmodule.exports = require(require.resolve(\"source-map\", { paths: [process.cwd()] }));\n`
  );
  // eslint-disable-next-line no-console
  console.log("[postinstall] ensured", target);
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("[postinstall] could not patch next compiled source-map:", e?.message || e);
}

