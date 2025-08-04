# DevBoot

Zero-config dev environment setup for modern web projects. Add TypeScript, Prettier, EditorConfig, and more to your project in seconds.

[![npm version](https://img.shields.io/npm/v/devboot.svg)](https://www.npmjs.com/package/devboot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)

## Why DevBoot?

Setting up a modern development environment is repetitive and time-consuming. Every new project needs:

- TypeScript with proper configurations
- Prettier for consistent code formatting
- EditorConfig for consistent coding styles
- Framework-specific optimizations
- Package manager detection

DevBoot automates all of this. Run one command, answer a few questions, and get a perfectly configured project.

## Quick Start

```bash
# Initialize DevBoot in your project
npx devboot init

# Add specific modules
npx devboot add typescript
npx devboot add prettier

# See available modules
npx devboot list

# Check your setup
npx devboot doctor
```

## Installation

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

## Features

- **Smart Detection**: Automatically detects your project type (Next.js, Vite, React, Node.js)
- **Modular System**: Add only what you need
- **Framework Optimized**: Tailored configs for each framework
- **Zero Config**: Sensible defaults that just work
- **Package Manager Aware**: Works with npm, pnpm, and yarn

## Supported Modules

### Essential Development Tools

- **typescript** - TypeScript configuration with framework-specific presets
- **prettier** - Code formatter with sensible defaults
- **editorconfig** - Consistent coding styles across different editors

## Commands

### `devboot init`

Initialize DevBoot in your project with an interactive setup.

```bash
devboot init
devboot init -y  # Use defaults, no prompts
```

### `devboot add <module>`

Add a specific module to your project.

```bash
devboot add typescript
devboot add prettier
devboot add editorconfig
```

### `devboot list`

List all available modules and their installation status.

```bash
devboot list
devboot list -i  # Show only installed modules
```

### `devboot doctor`

Check your DevBoot setup and project configuration.

```bash
devboot doctor
```

## Framework Support

DevBoot automatically detects and optimizes configurations for:

- **Next.js** - App Router and Pages Router support
- **Vite** - React, Vue, and vanilla projects
- **React** - Create React App and custom setups
- **Node.js** - Library and application projects

## Requirements

- Node.js 22 or higher
- npm, pnpm, or yarn

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [joseph0926](https://github.com/joseph0926)
