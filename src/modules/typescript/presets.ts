export interface TSConfigPreset {
  name: string;
  description: string;
  config: any;
  additionalFiles?: Record<string, string>;
}

export const COMPILER_OPTIONS = {
  targets: [
    { value: "ES2022", label: "ES2022", hint: "Node 16+ and modern browsers" },
    { value: "ES2020", label: "ES2020", hint: "Node 14+ and 2020+ browsers" },
    { value: "ES2017", label: "ES2017", hint: "Wider compatibility" },
    { value: "ES2015", label: "ES2015", hint: "Maximum compatibility" },
    { value: "ESNext", label: "ESNext", hint: "Latest features (unstable)" },
  ],

  modules: [
    { value: "NodeNext", label: "NodeNext", hint: "Modern Node.js with ESM" },
    { value: "ESNext", label: "ESNext", hint: "Latest ES modules" },
    { value: "ES2022", label: "ES2022", hint: "ES2022 modules" },
    { value: "CommonJS", label: "CommonJS", hint: "Traditional Node.js" },
    { value: "AMD", label: "AMD", hint: "Asynchronous Module Definition" },
    { value: "UMD", label: "UMD", hint: "Universal Module Definition" },
    { value: "System", label: "System", hint: "SystemJS loader" },
  ],

  moduleResolution: [
    {
      value: "bundler",
      label: "Bundler",
      hint: "For modern bundlers (recommended)",
    },
    { value: "node", label: "Node", hint: "Node.js style resolution" },
    { value: "node16", label: "Node16", hint: "Node.js 16+ with ESM" },
    { value: "nodenext", label: "NodeNext", hint: "Latest Node.js resolution" },
    {
      value: "classic",
      label: "Classic",
      hint: "Legacy TypeScript resolution",
    },
  ],

  strictness: [
    {
      value: "strict",
      label: "Strict",
      hint: "Maximum type safety (recommended)",
    },
    { value: "moderate", label: "Moderate", hint: "Balanced for migration" },
    { value: "loose", label: "Loose", hint: "Minimal checks" },
    { value: "custom", label: "Custom", hint: "Choose individual options" },
  ],

  jsx: [
    { value: "preserve", label: "Preserve", hint: "Keep JSX for bundler" },
    { value: "react-jsx", label: "React 17+", hint: "New JSX transform" },
    { value: "react-jsxdev", label: "React Dev", hint: "Development mode" },
    { value: "react", label: "React Classic", hint: "React.createElement" },
    { value: "react-native", label: "React Native", hint: "For RN projects" },
  ],

  libs: [
    { value: "default", label: "Default", hint: "Based on target" },
    { value: "dom", label: "DOM", hint: "Browser APIs" },
    { value: "webworker", label: "WebWorker", hint: "Worker APIs" },
    { value: "esnext", label: "ESNext", hint: "Latest ES features" },
    { value: "node", label: "Node", hint: "Node.js globals" },
    { value: "custom", label: "Custom", hint: "Select individually" },
  ],
};

export const FRAMEWORK_PRESETS: Record<string, TSConfigPreset> = {
  "next-app": {
    name: "Next.js App Router",
    description: "Next.js 13+ with App Router",
    config: {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
  },

  "next-pages": {
    name: "Next.js Pages Router",
    description: "Next.js with Pages Router",
    config: {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "node",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    },
  },

  "vite-react": {
    name: "Vite + React",
    description: "Vite with React and HMR",
    config: {
      compilerOptions: {
        target: "ES2022",
        useDefineForClassFields: true,
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }],
    },
    additionalFiles: {
      "tsconfig.node.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["ES2023"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowSyntheticDefaultImports: true,
            strict: true,
            types: ["vite/client"],
          },
          include: ["vite.config.ts"],
        },
        null,
        2
      ),
    },
  },

  "vite-vue": {
    name: "Vite + Vue",
    description: "Vite with Vue 3",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        skipLibCheck: true,
        noEmit: true,
        isolatedModules: true,
        moduleDetection: "force",
        jsx: "preserve",
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ["vite/client", "@types/node"],
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
      references: [{ path: "./tsconfig.node.json" }],
    },
  },

  "node-esm": {
    name: "Node.js ESM",
    description: "Modern Node.js with ES Modules",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        allowSyntheticDefaultImports: true,
        types: ["node"],
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
      "ts-node": {
        esm: true,
        experimentalSpecifierResolution: "node",
      },
    },
  },

  "node-commonjs": {
    name: "Node.js CommonJS",
    description: "Traditional Node.js with CommonJS",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        moduleResolution: "node",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        sourceMap: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
  },

  "express-api": {
    name: "Express API",
    description: "Express.js REST API server",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        moduleResolution: "node",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        types: ["node", "express"],
        typeRoots: ["./node_modules/@types", "./src/types"],
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "**/*.spec.ts"],
    },
  },

  "react-library": {
    name: "React Component Library",
    description: "Publishable React component library",
    config: {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        declaration: true,
        declarationMap: true,
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: false,
        isolatedModules: true,
        types: ["react", "react-dom"],
      },
      include: ["src/**/*"],
      exclude: [
        "node_modules",
        "dist",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.stories.tsx",
      ],
    },
  },

  "node-library": {
    name: "Node.js Library",
    description: "Publishable Node.js package",
    config: {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        moduleResolution: "node",
        lib: ["ES2020"],
        declaration: true,
        declarationMap: true,
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        types: ["node"],
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "**/*.test.ts"],
    },
  },

  "monorepo-root": {
    name: "Monorepo Root",
    description: "Root configuration for monorepo",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "node",
        composite: true,
        declaration: true,
        declarationMap: true,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      files: [],
      references: [{ path: "./packages/*/tsconfig.json" }],
    },
  },

  "monorepo-package": {
    name: "Monorepo Package",
    description: "Package within a monorepo",
    config: {
      extends: "../../tsconfig.json",
      compilerOptions: {
        outDir: "./dist",
        rootDir: "./src",
        composite: true,
        declaration: true,
        declarationMap: true,
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
  },

  "react-native": {
    name: "React Native",
    description: "React Native with TypeScript",
    config: {
      compilerOptions: {
        target: "ESNext",
        module: "CommonJS",
        lib: ["ES2022"],
        jsx: "react-native",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: "node",
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        types: ["react-native", "jest"],
      },
      exclude: [
        "node_modules",
        "babel.config.js",
        "metro.config.js",
        "jest.config.js",
      ],
    },
  },

  electron: {
    name: "Electron",
    description: "Electron desktop application",
    config: {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        lib: ["ES2022", "DOM"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        moduleResolution: "node",
        resolveJsonModule: true,
        types: ["node", "electron"],
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    },
  },
};

export const ADDITIONAL_OPTIONS = {
  experimental: [
    {
      value: "experimentalDecorators",
      label: "Decorators",
      hint: "Enable decorators",
    },
    {
      value: "emitDecoratorMetadata",
      label: "Decorator Metadata",
      hint: "For reflection",
    },
    {
      value: "useDefineForClassFields",
      label: "Class Fields",
      hint: "Standard behavior",
    },
  ],

  output: [
    {
      value: "declaration",
      label: "Type Declarations",
      hint: "Generate .d.ts files",
    },
    {
      value: "declarationMap",
      label: "Declaration Maps",
      hint: "Source maps for .d.ts",
    },
    { value: "sourceMap", label: "Source Maps", hint: "For debugging" },
    {
      value: "inlineSourceMap",
      label: "Inline Source Maps",
      hint: "Embed in output",
    },
    {
      value: "removeComments",
      label: "Remove Comments",
      hint: "Strip comments",
    },
    {
      value: "preserveConstEnums",
      label: "Preserve Const Enums",
      hint: "Keep enums",
    },
  ],

  imports: [
    {
      value: "allowSyntheticDefaultImports",
      label: "Synthetic Default Imports",
      hint: "import React",
    },
    {
      value: "allowImportingTsExtensions",
      label: "TS Extensions",
      hint: "import './file.ts'",
    },
    {
      value: "allowArbitraryExtensions",
      label: "Arbitrary Extensions",
      hint: "Any file type",
    },
    {
      value: "resolvePackageJsonExports",
      label: "Package Exports",
      hint: "Use exports field",
    },
    {
      value: "resolvePackageJsonImports",
      label: "Package Imports",
      hint: "Use imports field",
    },
  ],

  checks: [
    {
      value: "noUnusedLocals",
      label: "No Unused Locals",
      hint: "Error on unused vars",
    },
    {
      value: "noUnusedParameters",
      label: "No Unused Parameters",
      hint: "Error on unused params",
    },
    {
      value: "noImplicitReturns",
      label: "No Implicit Returns",
      hint: "All paths return",
    },
    {
      value: "noFallthroughCasesInSwitch",
      label: "No Fallthrough",
      hint: "Explicit breaks",
    },
    {
      value: "noUncheckedIndexedAccess",
      label: "Checked Index Access",
      hint: "Safer arrays",
    },
    {
      value: "noPropertyAccessFromIndexSignature",
      label: "No Index Access",
      hint: "Use bracket notation",
    },
    {
      value: "exactOptionalPropertyTypes",
      label: "Exact Optional",
      hint: "No undefined assignment",
    },
  ],
};

export function detectBestPreset(context: any): string | null {
  const deps = {
    ...context.packageJson.dependencies,
    ...context.packageJson.devDependencies,
  };

  if (deps.next) {
    const hasAppDir =
      context.hasSrcDirectory &&
      context.packageJson.scripts?.dev?.includes("next dev");
    return hasAppDir ? "next-app" : "next-pages";
  }

  if (deps.vite) {
    if (deps.vue) return "vite-vue";
    if (deps.react) return "vite-react";
    return "vite-react";
  }

  if (deps["react-native"]) return "react-native";

  if (deps.electron) return "electron";

  if (deps.express || deps.fastify || deps.koa) return "express-api";

  if (context.packageJson.main || context.packageJson.exports) {
    if (deps.react) return "react-library";
    return "node-library";
  }

  if (context.packageJson.workspaces) return "monorepo-root";

  return deps.react ? "react" : "node-esm";
}

export function getCustomStrictnessOptions() {
  return {
    typeChecking: [
      { value: "noImplicitAny", label: "No Implicit Any", default: true },
      { value: "strictNullChecks", label: "Strict Null Checks", default: true },
      {
        value: "strictFunctionTypes",
        label: "Strict Function Types",
        default: true,
      },
      {
        value: "strictBindCallApply",
        label: "Strict Bind/Call/Apply",
        default: true,
      },
      {
        value: "strictPropertyInitialization",
        label: "Strict Property Init",
        default: true,
      },
      { value: "noImplicitThis", label: "No Implicit This", default: true },
      { value: "alwaysStrict", label: "Always Strict Mode", default: true },
    ],
    codeQuality: [
      { value: "noUnusedLocals", label: "No Unused Locals", default: false },
      {
        value: "noUnusedParameters",
        label: "No Unused Parameters",
        default: false,
      },
      {
        value: "noImplicitReturns",
        label: "No Implicit Returns",
        default: false,
      },
      {
        value: "noFallthroughCasesInSwitch",
        label: "No Switch Fallthrough",
        default: false,
      },
      {
        value: "noUncheckedIndexedAccess",
        label: "Checked Array Access",
        default: false,
      },
    ],
  };
}
