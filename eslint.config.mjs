import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      // Assembled bundles the saksi-campaign console serves (tools/build-web.*).
      "**/dist-web/**",
      "**/target/**",
      "**/coverage/**",
      // Thesis document build scripts (docx assembly), not application code.
      "docs/**",
      "**/.dart_tool/**",
      "**/build/**",
      // Vendored saksi build output, copied unchanged (tools/sync-saksi-wasm.sh).
      "packages/saksi-wasm/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
