import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const console_ = process.env.VITE_CONSOLE_PROXY || "http://127.0.0.1:8090";

/**
 * In production the saksi-campaign console serves this bundle itself at
 * `/admin/`, so every API call is same-origin and carries the session cookie.
 * In dev, Vite proxies the console's prefixes to `VITE_CONSOLE_PROXY`. That
 * is deliberately not `VITE_CONSOLE_URL`, the browser's API base
 * (src/lib/bulletin.ts): pointing the proxy elsewhere must not also make the
 * browser call that console cross-origin, where CORS and the cookie fail.
 *
 * `removeHeader("origin")` is load-bearing: the console's guard() rejects any
 * POST whose Origin host differs from Host. `changeOrigin` rewrites Host to the
 * console but forwards the browser's `Origin: http://localhost:1420`, so every
 * write would 403. Stripping Origin puts the request in the no-browser-Origin
 * branch the guard already allows. Production is same-origin, so nothing is
 * weakened there.
 */
const consoleProxy: ProxyOptions = {
  target: console_,
  changeOrigin: true,
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
  },
};

export default defineConfig(async () => ({
  // The console mounts this app at /admin/, so assets must resolve there.
  base: "/admin/",
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
    proxy: Object.fromEntries(
      [
        "/api",
        "/runs",
        "/export",
        "/events",
        "/generate",
        "/verify",
        "/ceremony",
        "/board",
        "/trustee",
        "/trail",
      ].map((prefix) => [prefix, consoleProxy]),
    ),
  },
}));
