import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/**"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Nest modules are decorated empty classes.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
);
