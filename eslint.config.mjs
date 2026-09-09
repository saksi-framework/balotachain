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
      "**/.dart_tool/**",
      "**/build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
