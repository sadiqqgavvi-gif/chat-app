/* global process */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_TARGET = process.env.VITE_DEV_API_TARGET || "http://localhost:5000";

// In development the API and websocket are proxied through Vite, so the
// client talks to its own origin and needs no environment variables.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/socket.io": { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
});
