import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.BACKEND_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../backend/public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": backendTarget,
      "/files": backendTarget,
      "/p": backendTarget,
    },
  },
});
