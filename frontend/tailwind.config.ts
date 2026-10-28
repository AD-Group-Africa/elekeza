import type { Config } from "tailwindcss";

/**
 * Semantic colours map to the design tokens in src/styles/tokens.css, so they
 * follow the active theme (dark / light / calm) automatically. Prefer these in
 * new code (e.g. `bg-surface text-fg border-line`) over raw palette classes.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-primary)",
        surface: {
          DEFAULT: "var(--bg-card)",
          hover: "var(--bg-card-hover)",
        },
        line: {
          DEFAULT: "var(--border-color)",
          strong: "var(--border-strong)",
        },
        fg: {
          DEFAULT: "var(--text-primary)",
          muted: "var(--text-secondary)",
          subtle: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          // hover fill for bg-accent; strong is the readable text accent
          hover: "var(--accent-hover)",
          strong: "var(--accent-strong)",
          soft: "var(--accent-soft)",
          contrast: "var(--accent-contrast)",
        },
        ok: "var(--ek-ok)",
        warn: "var(--ek-warn)",
        danger: "var(--ek-danger)",
        info: "var(--ek-info)",
      },
      ringColor: {
        focus: "var(--focus-ring)",
      },
    },
  },
  plugins: [],
};

export default config;
