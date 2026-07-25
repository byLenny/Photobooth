import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// frontend/vite.config.ts is one level below the repo root.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const certFile = path.join(repoRoot, "certs", "cert.pem");
const keyFile = path.join(repoRoot, "certs", "key.pem");
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile);

const backendTarget =
  process.env.BACKEND_URL ?? (hasCerts ? "https://localhost:8080" : "http://localhost:8080");

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../backend/public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Bind every interface (not just localhost) when serving HTTPS, so a
    // kiosk on another device can reach this machine's LAN IP.
    host: hasCerts ? true : undefined,
    https: hasCerts ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) } : undefined,
    proxy: {
      // secure:false skips upstream cert verification — the backend uses
      // the same self-signed dev cert, which Node's TLS client won't trust.
      "/api": { target: backendTarget, changeOrigin: true, secure: false },
      "/files": { target: backendTarget, changeOrigin: true, secure: false },
      "/p": { target: backendTarget, changeOrigin: true, secure: false },
    },
  },
});
