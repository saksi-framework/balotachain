/// <reference types="vitest" />
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const console_ = process.env.VITE_CONSOLE_URL || "http://127.0.0.1:8090";

/**
 * In production the saksi-campaign console serves this bundle itself at
 * `/board/`, so every API call is same-origin. In dev, Vite proxies the
 * console's prefixes.
 *
 * `removeHeader("origin")` is load-bearing: the console's guard() rejects any
 * POST whose Origin host differs from Host. `changeOrigin` rewrites Host to the
 * console but forwards the browser's `Origin: http://localhost:1420`, so every
 * ceremony POST would 403. Stripping Origin puts the request in the
 * no-browser-Origin branch the guard already allows (the same one curl takes).
 * Production is same-origin, so nothing is weakened there.
 */
const consoleProxy: ProxyOptions = {
  target: console_,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
  },
};

export default defineConfig(async () => ({
  // The console mounts this app at /board/, so assets must resolve there.
  base: "/board/",
  plugins: [react()],
  clearScreen: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": consoleProxy,
      "/runs": consoleProxy,
      "/export": consoleProxy,
      "/trail": consoleProxy,
      "/events": consoleProxy,
      "/ceremony": consoleProxy,
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
