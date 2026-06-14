import { defineConfig } from "tsup";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    tokens: "src/tokens.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom", "react/jsx-runtime"],
  async onSuccess() {
    copyFileSync(resolve("src/styles.css"), resolve("dist/styles.css"));
  },
});
