import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "**/coverage/**",
      "**/.dart_tool/**",
      "**/build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
];
