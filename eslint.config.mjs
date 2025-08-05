import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  {
    "files": [
      "**/*.{js,jsx,ts,tsx}"
    ],
    "languageOptions": {
      "globals": {...globals.node, ...globals.es2021},
      "parser": tsParser,
      "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
      }
    },
    "plugins": {
      "@typescript-eslint": tseslint
    },
    "rules": {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn"
    }
  }
]);