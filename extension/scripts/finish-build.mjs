// Builds the content script, writes manifest.json with the API origin, and copies icons.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, cpSync } from "node:fs";
execSync("npx vite build -c vite.content.config.ts", { stdio: "inherit" });
const api = (process.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const manifest = readFileSync("manifest.json", "utf8").replace("__API_ORIGIN__", new URL(api).origin);
writeFileSync("dist/manifest.json", manifest);
cpSync("public/icons", "dist/icons", { recursive: true });
console.log("extension built for", api);
