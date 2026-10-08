import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { seoPlugin, siteConfig } from "./src/seo/build";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = env.VITE_SITE_URL ?? "";
  return {
    base: siteConfig(site).base,
    plugins: [react(), seoPlugin(site)],
    optimizeDeps: {
      include: [
        "exifr",
        "jszip",
        "pdfjs-dist",
        "pdf-lib",
        "libheif-js/libheif-wasm/libheif-bundle.mjs",
      ],
    },
    test: { include: ["tests/**/*.test.ts"] },
    server: { strictPort: true },
    worker: { format: "es" },
    build: { target: "es2022" },
  };
});
