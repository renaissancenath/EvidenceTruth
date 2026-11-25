import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/* Pages (popup, side panel) and the module service worker. The content script is built separately as one IIFE file. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } },
  build: {
    outDir: "dist", emptyOutDir: true, modulePreload: false,
    rollupOptions: {
      input: { popup: "popup.html", sidepanel: "sidepanel.html", worker: "src/background/worker.ts" },
      output: { entryFileNames: (c) => (c.name === "worker" ? "worker.js" : "assets/[name]-[hash].js") },
    },
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.ts"] },
});
