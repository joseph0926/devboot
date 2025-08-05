import type { ProjectContext } from "../../types/project.type.js";

export interface ESLintPreset {
  name: string;
  description: string;
  config: any;
  dependencies: {
    devDependencies: Record<string, string>;
  };
  additionalFiles?: Record<string, string>;
  configType?: "legacy" | "flat";
  eslintVersion?: "v8" | "v9";
}

export const ESLINT_V8_PRESETS: Record<string, ESLintPreset> = {
  react: {
    name: "React",
    description: "ESLint configuration for React projects",
    config: {
      env: {
        browser: true,
        es2021: true,
        node: true,
      },
      extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
        "prettier",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["react", "react-hooks", "jsx-a11y", "@typescript-eslint"],
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^8.57.0",
        "@typescript-eslint/eslint-plugin": "^6.21.0",
        "@typescript-eslint/parser": "^6.21.0",
        "eslint-plugin-react": "^7.33.2",
        "eslint-plugin-react-hooks": "^4.6.0",
        "eslint-plugin-jsx-a11y": "^6.8.0",
        "eslint-config-prettier": "^9.1.0",
      },
    },
  },
  next: {
    name: "Next.js",
    description: "ESLint configuration for Next.js projects",
    config: {
      extends: ["next/core-web-vitals", "@next/eslint-config-next"],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^8.57.0",
        "eslint-config-next": "^14.0.0",
        "@typescript-eslint/eslint-plugin": "^6.21.0",
        "@typescript-eslint/parser": "^6.21.0",
      },
    },
  },
  vite: {
    name: "Vite",
    description: "ESLint configuration for Vite projects",
    config: {
      env: {
        browser: true,
        es2021: true,
      },
      extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "prettier",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["react", "react-hooks", "@typescript-eslint"],
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^8.57.0",
        "@typescript-eslint/eslint-plugin": "^6.21.0",
        "@typescript-eslint/parser": "^6.21.0",
        "eslint-plugin-react": "^7.33.2",
        "eslint-plugin-react-hooks": "^4.6.0",
        "eslint-config-prettier": "^9.1.0",
      },
    },
  },
  node: {
    name: "Node.js",
    description: "ESLint configuration for Node.js projects",
    config: {
      env: {
        node: true,
        es2021: true,
      },
      extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "prettier",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "no-console": "warn",
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^8.57.0",
        "@typescript-eslint/eslint-plugin": "^6.21.0",
        "@typescript-eslint/parser": "^6.21.0",
        "eslint-config-prettier": "^9.1.0",
      },
    },
  },
  basic: {
    name: "Basic JavaScript",
    description: "Basic ESLint configuration for JavaScript projects",
    config: {
      env: {
        browser: true,
        node: true,
        es2021: true,
      },
      extends: ["eslint:recommended", "prettier"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "no-console": "warn",
        "prefer-const": "error",
        "no-var": "error",
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^8.57.0",
        "eslint-config-prettier": "^9.1.0",
      },
    },
  },
};

export const ESLINT_V9_PRESETS: Record<string, ESLintPreset> = {
  react: {
    name: "React (v9)",
    description: "Modern ESLint flat config for React projects",
    configType: "flat",
    eslintVersion: "v9",
    config: {
      env: {
        browser: true,
        es2021: true,
        node: true,
      },
      extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["react", "react-hooks", "@typescript-eslint"],
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^9.0.0",
        "@eslint/js": "^9.0.0",
        globals: "^15.0.0",
        "@typescript-eslint/eslint-plugin": "^7.0.0",
        "@typescript-eslint/parser": "^7.0.0",
        "eslint-plugin-react": "^7.33.2",
        "eslint-plugin-react-hooks": "^4.6.0",
      },
    },
  },
  next: {
    name: "Next.js (v9)",
    description: "Modern ESLint flat config for Next.js projects",
    configType: "flat",
    eslintVersion: "v9",
    config: {
      env: {
        browser: true,
        node: true,
        es2021: true,
      },
      extends: [
        "eslint:recommended",
        "@typescript-eslint/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["react", "react-hooks", "@typescript-eslint"],
      rules: {
        "react/react-in-jsx-scope": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/no-explicit-any": "warn",
      },
      settings: {
        react: { version: "detect" },
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^9.0.0",
        "@eslint/js": "^9.0.0",
        globals: "^15.0.0",
        "@typescript-eslint/eslint-plugin": "^7.0.0",
        "@typescript-eslint/parser": "^7.0.0",
        "eslint-plugin-react": "^7.33.2",
        "eslint-plugin-react-hooks": "^4.6.0",
      },
    },
  },
  node: {
    name: "Node.js (v9)",
    description: "Modern ESLint flat config for Node.js projects",
    configType: "flat",
    eslintVersion: "v9",
    config: {
      env: {
        node: true,
        es2021: true,
      },
      extends: ["eslint:recommended", "@typescript-eslint/recommended"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "no-console": "warn",
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^9.0.0",
        "@eslint/js": "^9.0.0",
        globals: "^15.0.0",
        "@typescript-eslint/eslint-plugin": "^7.0.0",
        "@typescript-eslint/parser": "^7.0.0",
      },
    },
  },
  basic: {
    name: "Basic JavaScript (v9)",
    description: "Modern ESLint flat config for JavaScript projects",
    configType: "flat",
    eslintVersion: "v9",
    config: {
      env: {
        browser: true,
        node: true,
        es2021: true,
      },
      extends: ["eslint:recommended"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      rules: {
        "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        "no-console": "warn",
        "prefer-const": "error",
        "no-var": "error",
      },
    },
    dependencies: {
      devDependencies: {
        eslint: "^9.0.0",
        "@eslint/js": "^9.0.0",
        globals: "^15.0.0",
      },
    },
  },
};

export const ESLINT_PRESETS: Record<string, ESLintPreset> = {
  ...ESLINT_V8_PRESETS,
  ...ESLINT_V9_PRESETS,
};

export function detectBestESLintPreset(context: ProjectContext): string | null {
  const { projectType, hasTypeScript } = context;

  switch (projectType) {
    case "next":
      return "next";
    case "vite":
      return "vite";
    case "react":
      return "react";
    case "node":
      return hasTypeScript ? "node" : "basic";
    default:
      return hasTypeScript ? "node" : "basic";
  }
}

export const ADDITIONAL_RULES = {
  strict: [
    {
      name: "Strict TypeScript",
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/no-non-null-assertion": "error",
      },
    },
    {
      name: "Strict React",
      rules: {
        "react/prop-types": "error",
        "react/jsx-props-no-spreading": "error",
        "react/no-array-index-key": "error",
        "jsx-a11y/alt-text": "error",
      },
    },
  ],
  performance: [
    {
      name: "Performance Rules",
      rules: {
        "no-console": "error",
        "no-debugger": "error",
        "prefer-const": "error",
        "no-var": "error",
      },
    },
  ],
  style: [
    {
      name: "Code Style",
      rules: {
        "prefer-arrow-callback": "error",
        "arrow-spacing": "error",
        "object-shorthand": "error",
        "prefer-template": "error",
      },
    },
  ],
};
