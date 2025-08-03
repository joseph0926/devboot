import * as prompts from "@clack/prompts";
import chalk from "chalk";
import type { ProjectContext } from "../../types/project.type.js";
import {
  COMPILER_OPTIONS,
  FRAMEWORK_PRESETS,
  ADDITIONAL_OPTIONS,
  detectBestPreset,
  getCustomStrictnessOptions,
} from "./presets.js";
import { fileExists } from "../../utils/file.js";
import path from "path";
import { TSConfigAnalyzer } from "./analyzer.js";

export interface BuildResult {
  config: string;
  additionalFiles?: Record<string, string>;
  presetKey: string | null;
}

export class TypeScriptConfigBuilder {
  private config: any = {};
  private selectedPreset: any = null;
  private presetKey: string | null = null;

  async build(context: ProjectContext): Promise<BuildResult> {
    prompts.intro(chalk.blue("🔧 TypeScript Configuration Setup"));

    await this.checkExistingConfig(context);

    this.selectedPreset = await this.selectFramework(context);
    this.config = JSON.parse(JSON.stringify(this.selectedPreset.config));

    await this.configureTarget();

    await this.configureModuleSystem();

    await this.configureStrictness();

    await this.configurePathAliases(context);

    await this.configureLibraries();

    await this.configureAdditionalOptions(context);

    await this.configureFilePatterns(context);

    const preview = this.generatePreview();
    prompts.log.message("");
    prompts.log.info("📄 Generated Configuration Preview:");
    prompts.log.message(chalk.gray(preview));

    const confirmed = await prompts.confirm({
      message: "Apply this configuration?",
      initialValue: true,
    });

    if (!confirmed || prompts.isCancel(confirmed)) {
      prompts.cancel("Configuration cancelled");
      throw new Error("Configuration cancelled");
    }

    if (this.selectedPreset.additionalFiles) {
      prompts.log.info(chalk.yellow("\n📝 Additional files will be created:"));
      Object.keys(this.selectedPreset.additionalFiles).forEach((file) => {
        prompts.log.message(chalk.gray(`  • ${file}`));
      });
    }

    prompts.outro(chalk.green("✅ TypeScript configuration complete!"));

    return {
      config: JSON.stringify(this.config, null, 2),
      additionalFiles: this.selectedPreset?.additionalFiles,
      presetKey: this.presetKey,
    };
  }

  private async checkExistingConfig(context: ProjectContext): Promise<void> {
    const tsconfigPath = path.join(context.projectPath, "tsconfig.json");

    if (await fileExists(tsconfigPath)) {
      const analyzer = new TSConfigAnalyzer();
      const analysis = await analyzer.analyze(context.projectPath);

      if (analysis.isValid) {
        prompts.log.warning("Found existing tsconfig.json");

        if (analysis.warnings.length > 0) {
          prompts.log.message(chalk.yellow("\n⚠️  Issues found:"));
          analysis.warnings.forEach((warn) => {
            prompts.log.message(chalk.gray(`  • ${warn}`));
          });
        }

        const action = await prompts.select({
          message: "How would you like to proceed?",
          options: [
            {
              value: "merge",
              label: "Merge with existing",
              hint: "Keep custom settings and update defaults",
            },
            {
              value: "replace",
              label: "Replace entirely",
              hint: "Start with fresh configuration",
            },
            {
              value: "cancel",
              label: "Cancel",
              hint: "Keep existing configuration",
            },
          ],
        });

        if (prompts.isCancel(action) || action === "cancel") {
          prompts.cancel("Keeping existing configuration");
          throw new Error("Cancelled");
        }

        this.config._action = action;
      }
    }
  }

  private async selectFramework(context: ProjectContext): Promise<any> {
    const detectedPresetKey = detectBestPreset(context);

    if (detectedPresetKey) {
      const detected = FRAMEWORK_PRESETS[detectedPresetKey];
      prompts.log.info(`Detected project type: ${chalk.cyan(detected.name)}`);

      const useDetected = await prompts.confirm({
        message: `Use ${detected.name} optimized settings?`,
        initialValue: true,
      });

      if (prompts.isCancel(useDetected)) {
        prompts.cancel("Setup cancelled");
        throw new Error("Cancelled");
      }

      if (useDetected) {
        return detected;
      }
    }

    const category = await prompts.select({
      message: "What type of project is this?",
      options: [
        {
          value: "frontend",
          label: "Frontend Application",
          hint: "React, Vue, Angular",
        },
        {
          value: "backend",
          label: "Backend Application",
          hint: "Node.js, Express, NestJS",
        },
        {
          value: "fullstack",
          label: "Full-stack Framework",
          hint: "Next.js, Remix, Nuxt",
        },
        {
          value: "library",
          label: "Library/Package",
          hint: "NPM package to publish",
        },
        {
          value: "mobile",
          label: "Mobile Application",
          hint: "React Native, Ionic",
        },
        {
          value: "desktop",
          label: "Desktop Application",
          hint: "Electron, Tauri",
        },
        {
          value: "monorepo",
          label: "Monorepo",
          hint: "Multi-package repository",
        },
        { value: "custom", label: "Custom", hint: "Configure from scratch" },
      ],
    });

    if (prompts.isCancel(category)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    const categoryPresets: Record<
      string,
      Array<{ key: string; preset: any }>
    > = {
      frontend: [
        { key: "vite-react", preset: FRAMEWORK_PRESETS["vite-react"] },
        { key: "vite-vue", preset: FRAMEWORK_PRESETS["vite-vue"] },
        { key: "react", preset: FRAMEWORK_PRESETS["react"] },
      ],
      backend: [
        { key: "node-esm", preset: FRAMEWORK_PRESETS["node-esm"] },
        { key: "node-commonjs", preset: FRAMEWORK_PRESETS["node-commonjs"] },
        { key: "express-api", preset: FRAMEWORK_PRESETS["express-api"] },
      ],
      fullstack: [
        { key: "next-app", preset: FRAMEWORK_PRESETS["next-app"] },
        { key: "next-pages", preset: FRAMEWORK_PRESETS["next-pages"] },
      ],
      library: [
        { key: "react-library", preset: FRAMEWORK_PRESETS["react-library"] },
        { key: "node-library", preset: FRAMEWORK_PRESETS["node-library"] },
      ],
      mobile: [
        { key: "react-native", preset: FRAMEWORK_PRESETS["react-native"] },
      ],
      desktop: [{ key: "electron", preset: FRAMEWORK_PRESETS["electron"] }],
      monorepo: [
        { key: "monorepo-root", preset: FRAMEWORK_PRESETS["monorepo-root"] },
        {
          key: "monorepo-package",
          preset: FRAMEWORK_PRESETS["monorepo-package"],
        },
      ],
      custom: [],
    };

    if (category === "custom") {
      return FRAMEWORK_PRESETS["node-commonjs"];
    }

    const presets = categoryPresets[category] || [];

    const selectedKey = await prompts.select({
      message: "Select specific configuration",
      options: presets.map(({ key, preset }) => ({
        value: key,
        label: preset.name,
        hint: preset.description,
      })),
    });

    if (prompts.isCancel(selectedKey)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    this.presetKey = selectedKey;
    return FRAMEWORK_PRESETS[selectedKey];
  }

  private async configureTarget(): Promise<void> {
    const customizeTarget = await prompts.confirm({
      message: "Customize compilation target?",
      initialValue: false,
    });

    if (prompts.isCancel(customizeTarget) || !customizeTarget) {
      return;
    }

    prompts.log.step(chalk.cyan("Compilation Target"));

    const target = await prompts.select({
      message: "Select ECMAScript target version",
      options: COMPILER_OPTIONS.targets,
    });

    if (!prompts.isCancel(target)) {
      this.config.compilerOptions.target = target;
    }
  }

  private async configureModuleSystem(): Promise<void> {
    const customizeModule = await prompts.confirm({
      message: "Customize module system?",
      initialValue: false,
    });

    if (prompts.isCancel(customizeModule) || !customizeModule) {
      return;
    }

    prompts.log.step(chalk.cyan("Module System"));

    const moduleSystem = await prompts.select({
      message: "Select module system",
      options: COMPILER_OPTIONS.modules,
    });

    if (!prompts.isCancel(moduleSystem)) {
      this.config.compilerOptions.module = moduleSystem;

      const moduleResolution = await prompts.select({
        message: "Select module resolution strategy",
        options: COMPILER_OPTIONS.moduleResolution,
      });

      if (!prompts.isCancel(moduleResolution)) {
        this.config.compilerOptions.moduleResolution = moduleResolution;
      }
    }
  }

  private async configureStrictness(): Promise<void> {
    prompts.log.step(chalk.cyan("Type Checking Strictness"));

    const strictness = await prompts.select({
      message: "Select type checking strictness level",
      options: COMPILER_OPTIONS.strictness,
    });

    if (prompts.isCancel(strictness)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    if (strictness === "custom") {
      await this.configureCustomStrictness();
    } else {
      const strictOptions = getCustomStrictnessOptions();
      this.config.compilerOptions = {
        ...this.config.compilerOptions,
        ...strictOptions,
      };
    }

    if (
      this.config.compilerOptions.typeChecking ||
      this.config.compilerOptions.codeQuality
    ) {
      console.warn("Warning: Invalid keys detected in compilerOptions");
      delete this.config.compilerOptions.typeChecking;
      delete this.config.compilerOptions.codeQuality;
    }

    prompts.log.success(`${strictness} mode configured`);
  }

  private async configureCustomStrictness(): Promise<void> {
    const customOptions = getCustomStrictnessOptions();

    prompts.log.info("Configure individual strict options");

    const typeChecking = await prompts.multiselect({
      message: "Type checking options",
      options: customOptions.typeChecking.map((opt) => ({
        value: opt.value,
        label: opt.label,
        selected: opt.default,
      })),
    });

    if (!prompts.isCancel(typeChecking)) {
      typeChecking.forEach((optionName) => {
        this.config.compilerOptions[optionName] = true;
      });
    }

    const codeQuality = await prompts.multiselect({
      message: "Code quality options",
      options: customOptions.codeQuality.map((opt) => ({
        value: opt.value,
        label: opt.label,
        selected: opt.default,
      })),
    });

    if (!prompts.isCancel(codeQuality)) {
      codeQuality.forEach((optionName) => {
        this.config.compilerOptions[optionName] = true;
      });
    }
  }

  private async configurePathAliases(context: ProjectContext): Promise<void> {
    const hasAliases = await prompts.confirm({
      message: "Configure path aliases? (e.g., @/components)",
      initialValue: true,
    });

    if (prompts.isCancel(hasAliases) || !hasAliases) {
      return;
    }

    prompts.log.step(chalk.cyan("Path Aliases Configuration"));

    const hasSrc = await fileExists(path.join(context.projectPath, "src"));

    const baseUrl = await prompts.select({
      message: "Select base directory for path resolution",
      options: [
        {
          value: ".",
          label: "Project root (.)",
          hint: "Resolve from project root",
        },
        ...(hasSrc
          ? [
              {
                value: "./src",
                label: "Source directory (./src)",
                hint: "Resolve from src folder",
              },
            ]
          : []),
      ],
    });

    if (prompts.isCancel(baseUrl)) {
      return;
    }

    this.config.compilerOptions.baseUrl = baseUrl;

    const aliasPresets = await prompts.select({
      message: "Choose alias style",
      options: [
        { value: "simple", label: "Simple (@/*)", hint: "Single root alias" },
        {
          value: "structured",
          label: "Structured",
          hint: "Multiple specific aliases",
        },
        { value: "custom", label: "Custom", hint: "Define your own" },
        { value: "none", label: "Skip", hint: "No aliases" },
      ],
    });

    if (prompts.isCancel(aliasPresets) || aliasPresets === "none") {
      return;
    }

    const paths: Record<string, string[]> = {};

    if (aliasPresets === "simple") {
      paths["@/*"] = [baseUrl === "." ? "./src/*" : "./*"];
    } else if (aliasPresets === "structured") {
      const defaultAliases = await prompts.multiselect({
        message: "Select path aliases to configure",
        options: [
          { value: "@/*", label: "@/* → src/*", hint: "Root alias" },
          { value: "@components/*", label: "@components/* → components/*" },
          { value: "@pages/*", label: "@pages/* → pages/*" },
          { value: "@utils/*", label: "@utils/* → utils/*" },
          { value: "@hooks/*", label: "@hooks/* → hooks/*" },
          { value: "@lib/*", label: "@lib/* → lib/*" },
          { value: "@api/*", label: "@api/* → api/*" },
          { value: "@types/*", label: "@types/* → types/*" },
          { value: "@styles/*", label: "@styles/* → styles/*" },
          { value: "@assets/*", label: "@assets/* → assets/*" },
        ],
        initialValues: ["@/*"],
      });

      if (!prompts.isCancel(defaultAliases)) {
        for (const alias of defaultAliases) {
          if (alias === "@/*") {
            paths[alias] = [baseUrl === "." ? "./src/*" : "./*"];
          } else {
            const folderName = alias.match(/@(\w+)\/\*/)?.[1] || "";
            paths[alias] = [
              baseUrl === "." ? `./src/${folderName}/*` : `./${folderName}/*`,
            ];
          }
        }
      }
    }

    if (aliasPresets === "custom" || aliasPresets === "structured") {
      const addCustom = await prompts.confirm({
        message: "Add custom path aliases?",
        initialValue: aliasPresets === "custom",
      });

      if (!prompts.isCancel(addCustom) && addCustom) {
        let addMore = true;
        while (addMore) {
          const aliasName = await prompts.text({
            message: "Alias pattern (e.g., @custom/*)",
            placeholder: "@custom/*",
            validate: (value) => {
              if (!value.includes("*")) {
                return "Alias must include * for wildcard matching";
              }
              return undefined;
            },
          });

          if (prompts.isCancel(aliasName)) break;

          const aliasPath = await prompts.text({
            message: `Path for ${aliasName}`,
            placeholder: "./src/custom/*",
            validate: (value) => {
              if (!value.includes("*")) {
                return "Path must include * for wildcard matching";
              }
              return undefined;
            },
          });

          if (prompts.isCancel(aliasPath)) break;

          paths[aliasName] = [aliasPath];

          const continueAdding = await prompts.confirm({
            message: "Add another alias?",
            initialValue: false,
          });

          if (prompts.isCancel(continueAdding) || !continueAdding) {
            addMore = false;
          }
        }
      }
    }

    if (Object.keys(paths).length > 0) {
      this.config.compilerOptions.paths = paths;
    }
  }

  private async configureLibraries(): Promise<void> {
    const customizeLibs = await prompts.confirm({
      message: "Customize included type libraries?",
      initialValue: false,
    });

    if (prompts.isCancel(customizeLibs) || !customizeLibs) {
      return;
    }

    prompts.log.step(chalk.cyan("Type Libraries"));

    const libPreset = await prompts.select({
      message: "Select library preset",
      options: COMPILER_OPTIONS.libs,
    });

    if (prompts.isCancel(libPreset)) {
      return;
    }

    if (libPreset === "custom") {
      const libs = await prompts.multiselect({
        message: "Select type libraries to include",
        options: [
          { value: "ES2015", label: "ES2015", hint: "ES6 features" },
          {
            value: "ES2017",
            label: "ES2017",
            hint: "Async/await, Object methods",
          },
          {
            value: "ES2020",
            label: "ES2020",
            hint: "Optional chaining, BigInt",
          },
          { value: "ES2022", label: "ES2022", hint: "Top-level await, .at()" },
          { value: "ESNext", label: "ESNext", hint: "Latest features" },
          { value: "DOM", label: "DOM", hint: "Browser DOM API" },
          {
            value: "DOM.Iterable",
            label: "DOM.Iterable",
            hint: "DOM collections",
          },
          { value: "WebWorker", label: "WebWorker", hint: "Web Worker API" },
          {
            value: "ScriptHost",
            label: "ScriptHost",
            hint: "Windows Script Host",
          },
        ],
      });

      if (!prompts.isCancel(libs)) {
        this.config.compilerOptions.lib = libs;
      }
    } else if (libPreset !== "default") {
      const libMap: Record<string, string[]> = {
        dom: ["ES2022", "DOM", "DOM.Iterable"],
        webworker: ["ES2022", "WebWorker"],
        node: ["ES2022"],
        esnext: ["ESNext", "DOM", "DOM.Iterable"],
      };

      if (libMap[libPreset]) {
        this.config.compilerOptions.lib = libMap[libPreset];
      }
    }
  }

  private async configureAdditionalOptions(
    context: ProjectContext
  ): Promise<void> {
    const addMore = await prompts.confirm({
      message: "Configure additional options?",
      initialValue: false,
    });

    if (prompts.isCancel(addMore) || !addMore) {
      return;
    }

    prompts.log.step(chalk.cyan("Additional Options"));

    const experimental = await prompts.multiselect({
      message: "Experimental features",
      options: ADDITIONAL_OPTIONS.experimental,
      required: false,
    });

    if (!prompts.isCancel(experimental)) {
      experimental.forEach((opt) => {
        this.config.compilerOptions[opt] = true;
      });
    }

    const output = await prompts.multiselect({
      message: "Output options",
      options: ADDITIONAL_OPTIONS.output,
      required: false,
    });

    if (!prompts.isCancel(output)) {
      output.forEach((opt) => {
        this.config.compilerOptions[opt] = true;
      });

      if (output.includes("declaration") || context.projectType === "node") {
        const needsOutDir = await prompts.confirm({
          message: "Configure output directories?",
          initialValue: true,
        });

        if (!prompts.isCancel(needsOutDir) && needsOutDir) {
          const outDir = await prompts.text({
            message: "Output directory",
            placeholder: "./dist",
            initialValue: "./dist",
          });

          if (!prompts.isCancel(outDir)) {
            this.config.compilerOptions.outDir = outDir;

            const rootDir = await prompts.text({
              message: "Source root directory",
              placeholder: "./src",
              initialValue: "./src",
            });

            if (!prompts.isCancel(rootDir)) {
              this.config.compilerOptions.rootDir = rootDir;
            }
          }
        }
      }
    }

    const imports = await prompts.multiselect({
      message: "Import handling options",
      options: ADDITIONAL_OPTIONS.imports,
      required: false,
    });

    if (!prompts.isCancel(imports)) {
      imports.forEach((opt) => {
        this.config.compilerOptions[opt] = true;
      });
    }

    const checks = await prompts.multiselect({
      message: "Additional type checks",
      options: ADDITIONAL_OPTIONS.checks,
      required: false,
    });

    if (!prompts.isCancel(checks)) {
      checks.forEach((opt) => {
        this.config.compilerOptions[opt] = true;
      });
    }
  }

  private async configureFilePatterns(context: ProjectContext): Promise<void> {
    const customizePatterns = await prompts.confirm({
      message: "Customize file include/exclude patterns?",
      initialValue: false,
    });

    if (prompts.isCancel(customizePatterns) || !customizePatterns) {
      return;
    }

    prompts.log.step(chalk.cyan("File Patterns"));

    const currentIncludes = this.config.include || ["src/**/*"];
    prompts.log.info(`Current include: ${currentIncludes.join(", ")}`);

    const modifyIncludes = await prompts.confirm({
      message: "Modify include patterns?",
      initialValue: false,
    });

    if (!prompts.isCancel(modifyIncludes) && modifyIncludes) {
      const includePatterns = await prompts.text({
        message: "Include patterns (comma-separated)",
        placeholder: "src/**/*,tests/**/*",
        initialValue: currentIncludes.join(","),
      });

      if (!prompts.isCancel(includePatterns)) {
        this.config.include = includePatterns.split(",").map((p) => p.trim());
      }
    }

    const currentExcludes = this.config.exclude || ["node_modules"];
    prompts.log.info(`Current exclude: ${currentExcludes.join(", ")}`);

    const additionalExcludes = await prompts.multiselect({
      message: "Additional exclude patterns",
      options: [
        { value: "dist", label: "dist", hint: "Build output" },
        { value: "build", label: "build", hint: "Build output" },
        { value: "coverage", label: "coverage", hint: "Test coverage" },
        { value: "**/*.spec.ts", label: "*.spec.ts", hint: "Test files" },
        { value: "**/*.test.ts", label: "*.test.ts", hint: "Test files" },
        {
          value: "**/*.stories.tsx",
          label: "*.stories.tsx",
          hint: "Storybook files",
        },
        { value: ".next", label: ".next", hint: "Next.js build" },
        { value: ".cache", label: ".cache", hint: "Cache directories" },
      ],
      required: false,
    });

    if (!prompts.isCancel(additionalExcludes)) {
      this.config.exclude = [
        ...new Set([...currentExcludes, ...additionalExcludes]),
      ];
    }
  }

  private generatePreview(): string {
    const preview = JSON.stringify(this.config, null, 2);
    const lines = preview.split("\n");
    const maxLines = 40;

    if (lines.length <= maxLines) {
      return preview;
    }

    return lines.slice(0, maxLines).join("\n") + "\n...";
  }
}
