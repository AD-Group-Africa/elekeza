import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Never lint generated output.
  globalIgnores([
    ".next/**",
    // Any alternate Next build dir (NEXT_DIST_DIR), e.g. .next-e2e for Playwright.
    ".next-*/**",
    ".netlify/**",
    "out/**",
    "build/**",
    "android/**",
    "public/sw.js",
    "public/workbox-*.js",
    "public/fallback-*.js",
    "generate-icons.cjs",
    "next-env.d.ts",
  ]),
  {
    // Dev-only capture/verification scripts drive Playwright with loosely
    // typed page objects; strict typing there adds noise, not safety.
    files: ["scripts/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
]);

export default eslintConfig;
