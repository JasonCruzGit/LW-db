import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        stage: {
          bg: "#0a0a0b",
          card: "#141416",
          accent: "#22c55e",
          muted: "#71717a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
