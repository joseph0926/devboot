# DevBoot

Zero-config dev environment setup for modern web projects. Add ESLint, Prettier, TypeScript, and more to your project in seconds.

[![npm version](https://img.shields.io/npm/v/devboot.svg)](https://www.npmjs.com/package/devboot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

https://github.com/user-attachments/assets/4b4dfa88-fda8-4de6-9199-2aeab2f1f354

## Why DevBoot?

Setting up a modern development environment is repetitive and time-consuming. Every new project needs:

- ESLint + Prettier configuration
- TypeScript with proper settings
- Git hooks for code quality
- Testing framework setup
- Editor configurations

DevBoot automates all of this. Run one command, answer a few questions, and get a perfectly configured project.

## Quick Start

```bash
# ..
```

## Features

- **Smart Detection**: Automatically detects your project type (Next.js, Vite, React, etc.)
- **Modular System**: Add only what you need
- **Framework Optimized**: Tailored configs for each framework
- **Zero Dependencies**: Runs without installing globally

## Supported Modules

### Essential Development Tools

- **eslint-prettier** - Code formatting and linting
- **typescript** - TypeScript configuration
- **git-hooks** - Husky + lint-staged
- **editor-config** - VS Code and EditorConfig settings

### Testing

- **vitest** - Modern unit testing

### Styling

- **tailwind** - Tailwind CSS with PostCSS

## Usage

### Initialize DevBoot in your project

### Development

```bash
git clone https://github.com/joseph0926/devboot.git

pnpm install

pnpm cli init
pnpm cli add {module}
pnpm cli list
pnpm cli doctor
```

## License

MIT © [joseph0926](https://github.com/joseph0926/devboot/LICENCE)
