import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The saksi-campaign console serves this bundle at `/vote/` in live mode, so
 * every asset must resolve there. Task 5a talks to no server at all (the mock
 * client runs in memory), so there is no dev proxy yet; task 5b adds the
 * console's prefixes the way apps/trustee does.
 */
export default defineConfig({
  base: "/vote/",
  plugins: [react()],
  clearScreen: false,
  // The saksi WebAssembly glue fetches its .wasm by URL; pre-bundling would
  // move the glue away from the file (saksi docs/live/wire-format.md).
  // `voterCrypto.ts` imports the .wasm with `?url`, so the build emits it
  // under /vote/assets/.
  optimizeDeps: { exclude: ["@saksi/wasm"] },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 1430,
    strictPort: true,
  },
});
