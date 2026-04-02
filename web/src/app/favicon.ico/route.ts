import { NextResponse } from "next/server";

export function GET() {
  // Browsers request /favicon.ico by default. We serve the existing SVG to avoid 404s.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="#18181b" />
  <rect x="6" y="6" width="20" height="20" rx="3" stroke="#fafafa" stroke-opacity="0.35" stroke-width="1.5" />
</svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

