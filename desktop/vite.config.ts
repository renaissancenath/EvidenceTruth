import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// base "./" because Electron loads the built files from disk (file://)
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true, rollupOptions: { input: { panel: "panel.html", bubble: "bubble.html" } } },
});
