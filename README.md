# DevBoot 🚀

Zero-config dev environment setup for modern web projects. Add TypeScript, ESLint, Prettier, EditorConfig, and more to your project in seconds with intelligent configuration detection.

[![npm version](https://img.shields.io/npm/v/devboot.svg)](https://www.npmjs.com/package/devboot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)

## ✨ Why DevBoot?

Setting up a modern development environment is repetitive and time-consuming. Every new project needs:

- **ESLint** with v8/v9 support and framework-specific rules
- **Prettier** for consistent code formatting  
- **TypeScript** with proper configurations
- **EditorConfig** for consistent coding styles
- **Framework-specific optimizations**
- **Package manager detection**
- **Flexible configuration file formats**

DevBoot automates all of this with **intelligent environment detection** and **flexible configuration formats**. Run one command, and get a perfectly configured project that adapts to your setup.

## 🎯 What's New in v0.1.0

- **🔧 ESLint v9 Flat Config Support** - Full support for both legacy (.eslintrc) and modern (eslint.config) formats
- **📁 Smart Config Format Detection** - Automatically chooses the best config file format (.json, .js, .mjs, .cjs, .ts, .yml)
- **🤖 Non-Interactive Mode** - Perfect for CI/CD pipelines and automation
- **🎨 Enhanced Prettier Integration** - Flexible format support with project environment awareness
- **⚡ Improved Performance** - Faster setup with better error handling

## 🚀 Quick Start

```bash
# Initialize DevBoot in your project
npx devboot init

# Add specific modules
npx devboot add eslint prettier
npx devboot add typescript

# See available modules
npx devboot list

# Check your setup
npx devboot doctor
```

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g devboot
# or
pnpm add -g devboot
# or  
yarn global add devboot
```

### Run without installing

```bash
npx devboot init
```

## ✨ Features

### 🧠 Intelligent Configuration

- **Smart Project Detection**: Automatically detects Next.js, Vite, React, Node.js, and more
- **Environment-Aware**: Adapts to TypeScript, ES Modules, package managers
- **Config Format Intelligence**: Chooses optimal formats (.json, .js, .mjs, .cjs, .ts, .yml)

### 🛠️ Modern Tool Support

- **ESLint v8 & v9**: Full support for both legacy and flat config systems
- **Flexible File Formats**: Supports all major configuration file extensions
- **Framework Optimized**: Tailored configs for each framework
- **CI/CD Ready**: Non-interactive mode for automation

### 🎨 Developer Experience

- **Zero Config**: Sensible defaults that just work
- **Interactive Setup**: Guided configuration with smart recommendations
- **Package Manager Aware**: Works seamlessly with npm, pnpm, and yarn
- **Error Recovery**: Helpful error messages with suggested solutions

## 🧩 Supported Modules

### Core Development Tools

| Module | Description | Config Formats | Features |
|--------|-------------|----------------|----------|
| **eslint** | JavaScript/TypeScript linter | `.eslintrc.json`, `.eslintrc.js`, `eslint.config.ts`, `eslint.config.mjs` | ESLint v8/v9, Flat config, Framework presets |
| **prettier** | Code formatter | `.prettierrc.json`, `prettier.config.js`, `.prettierrc.mjs` | Smart defaults, Framework integration |
| **typescript** | TypeScript configuration | `tsconfig.json` | Framework-specific presets, Path mapping |
| **editorconfig** | Consistent coding styles | `.editorconfig` | Cross-editor compatibility |

### 🎛️ Configuration Format Examples

DevBoot intelligently selects the best configuration format based on your project:

#### TypeScript Projects
```bash
# Generates:
eslint.config.ts     # ESLint v9 with TypeScript
prettier.config.js   # Prettier with JS for flexibility
tsconfig.json        # TypeScript configuration
```

#### ES Modules Projects  
```bash
# Generates:
eslint.config.mjs    # ESLint v9 with ES modules
.prettierrc.mjs      # Prettier with ES modules
```

#### Legacy Projects
```bash
# Generates:
.eslintrc.json       # ESLint v8 legacy format
.prettierrc.json     # Prettier JSON format
```

## 📋 Commands

### `devboot init`

Initialize DevBoot in your project with an interactive setup.

```bash
devboot init                 # Interactive setup
devboot init -y             # Use defaults, no prompts
devboot init --dry-run      # Preview without making changes
```

### `devboot add <modules...>`

Add specific modules to your project.

```bash
devboot add eslint          # Add ESLint with smart config detection
devboot add prettier        # Add Prettier with format selection
devboot add typescript      # Add TypeScript configuration
devboot add eslint prettier # Add multiple modules at once

# Options
devboot add eslint --dry-run    # Preview without installing
devboot add eslint --verbose    # Show detailed output
devboot add eslint --no-install # Skip dependency installation
```

### `devboot list`

List all available modules and their installation status.

```bash
devboot list        # Show all modules
devboot list -i     # Show only installed modules
```

### `devboot doctor`

Check your DevBoot setup and project configuration.

```bash
devboot doctor      # Run health checks
```

## 🎯 Framework Support

DevBoot automatically detects and optimizes configurations for:

- **Next.js** - App Router and Pages Router support, optimized ESLint rules
- **Vite** - React, Vue, and vanilla projects with build optimizations  
- **React** - Create React App and custom setups with JSX support
- **Node.js** - Library and application projects with appropriate globals
- **TypeScript** - Full TypeScript integration across all frameworks

## 🔧 ESLint Configuration Guide

### ESLint v9 (Flat Config) - Recommended

For new projects, DevBoot uses ESLint v9's modern flat config system:

```typescript
// eslint.config.ts (TypeScript projects)
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";

export default defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {...globals.node, ...globals.es2021},
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Framework-specific rules
    }
  }
]);
```

### ESLint v8 (Legacy) - Compatibility

For existing projects, DevBoot can generate legacy format:

```json
// .eslintrc.json
{
  "extends": ["@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "env": {
    "node": true,
    "es2021": true
  }
}
```

## 🎨 Prettier Configuration

DevBoot generates Prettier configs optimized for your project:

```javascript
// prettier.config.js (TypeScript projects)
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 80,
  parser: 'typescript'  // Auto-detected for TS projects
};
```

## 🤖 CI/CD Integration

DevBoot works seamlessly in automated environments:

```yaml
# GitHub Actions example
- name: Setup development tools
  run: |
    CI=true npx devboot add eslint prettier
    
# The CI=true flag enables non-interactive mode
```

## ⚙️ Advanced Usage

### Custom Configuration

```bash
# Preview configuration before applying
devboot add eslint --dry-run

# Verbose output for debugging
devboot add eslint --verbose

# Force overwrite existing configs
devboot add eslint --force
```

### Multiple Environments

DevBoot adapts to your project structure:

```bash
# Monorepo root
devboot init

# Individual packages  
cd packages/web && devboot add eslint prettier
cd packages/api && devboot add eslint typescript
```

## 🛠️ Requirements

- **Node.js** 22 or higher
- **Package Manager**: npm, pnpm, or yarn
- **Git** (recommended for change tracking)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/your-username/devboot.git`
3. **Install dependencies**: `pnpm install`
4. **Run tests**: `pnpm test`
5. **Make your changes**
6. **Submit a pull request**

### Development Commands

```bash
pnpm dev          # Start development mode
pnpm test         # Run tests
pnpm test:coverage # Run tests with coverage
pnpm build        # Build for production
pnpm cli          # Test CLI locally
```

### Project Structure

```
src/
├── cli/          # CLI commands and flows
├── core/         # Core functionality (installer, analyzer)
├── modules/      # Individual modules (eslint, prettier, etc.)
├── utils/        # Shared utilities
└── types/        # TypeScript type definitions
```

## 📝 Changelog

### v0.1.0 (Latest)
- ✨ ESLint v9 Flat Config support
- 🔧 Intelligent config format detection
- 🤖 Non-interactive mode for CI/CD
- 📁 Support for .js, .mjs, .cjs, .ts, .yml formats
- ⚡ Performance improvements
- 🐛 Bug fixes and stability improvements

## 🙏 Acknowledgments

- [ESLint](https://eslint.org/) - Pluggable JavaScript linter
- [Prettier](https://prettier.io/) - Opinionated code formatter
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
- [@clack/prompts](https://github.com/natemoo-re/clack) - Beautiful CLI prompts

## 📄 License

MIT © [joseph0926](https://github.com/joseph0926)

---

<div align="center">

**[Documentation](https://github.com/joseph0926/devboot#readme) • [Issues](https://github.com/joseph0926/devboot/issues) • [Contributing](https://github.com/joseph0926/devboot/blob/main/CONTRIBUTING.md)**

</div>