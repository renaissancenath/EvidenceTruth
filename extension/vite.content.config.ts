import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: false, lib: { entry: "src/content/content.ts", formats: ["iife"], name: "etContent", fileName: () => "content.js" } },
});
