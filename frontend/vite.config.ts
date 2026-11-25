import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173, proxy: { "/v1": "http://127.0.0.1:8000" }, fs: { allow: [".."] } },
  build: { outDir: "dist", sourcemap: false },
  test: { environment: "jsdom", include: ["src/**/*.test.tsx", "src/**/*.test.ts"] },
});
