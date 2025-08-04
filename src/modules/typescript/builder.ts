import * as prompts from "@clack/prompts";
import chalk from "chalk";
import type { ProjectContext } from "../../types/project.type.js";
import {
  COMPILER_OPTIONS,
  FRAMEWORK_PRESETS,
  ADDITIONAL_OPTIONS,
  detectBestPreset,
  getCustomStrictnessOptions,
  type TSConfigPreset,
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

    const setupMode = await prompts.select({
      message: "How would you like to set it up?",
      options: [
        {
          value: "quick",
          label: "🚀 Quick setup",
          hint: "Automatically choose an optimized preset for your project",
        },
        {
          value: "custom",
          label: "🛠️  Custom setup",
          hint: "Configure step-by-step with fine-grained options",
        },
      ],
    });

    if (prompts.isCancel(setupMode)) {
      prompts.cancel("Setup canceled");
      throw new Error("Cancelled");
    }

    if (setupMode === "quick") {
      return await this.quickSetup(context);
    } else {
      return await this.customSetup(context);
    }
  }

  private async quickSetup(context: ProjectContext): Promise<BuildResult> {
    const detectedPresetKey = detectBestPreset(context);

    if (detectedPresetKey) {
      const preset = FRAMEWORK_PRESETS[detectedPresetKey];
      if (!preset) {
        prompts.log.warning("Could not find the detected preset");
        return await this.selectPresetManually(context);
      }

      prompts.log.info(
        `\n🎯 Detected project type: ${chalk.cyan(preset.name)}`,
      );
      prompts.log.message(chalk.gray(`  ${preset.description}`));

      const showDetails = await prompts.confirm({
        message: "Would you like to review the configuration details?",
        initialValue: false,
      });

      if (!prompts.isCancel(showDetails) && showDetails) {
        prompts.log.message("\n📋 Configuration to be applied:");
        this.displayPresetDetails(preset);
      }

      const useDetected = await prompts.confirm({
        message: `Apply ${preset.name} configuration?`,
        initialValue: true,
      });

      if (prompts.isCancel(useDetected)) {
        prompts.cancel("Setup canceled");
        throw new Error("Cancelled");
      }

      if (!useDetected) {
        prompts.log.info("Please select a different preset");
        return await this.selectPresetManually(context);
      }

      this.selectedPreset = preset;
      this.presetKey = detectedPresetKey;
      this.config = JSON.parse(JSON.stringify(preset.config));

      const customize = await prompts.confirm({
        message: "Would you like to add customizations?",
        initialValue: false,
      });

      if (!prompts.isCancel(customize) && customize) {
        await this.quickCustomize(context);
      }
    } else {
      prompts.log.warning("Could not automatically detect the project type");
      return await this.selectPresetManually(context);
    }

    return this.finalizeConfiguration();
  }

  private async customSetup(context: ProjectContext): Promise<BuildResult> {
    this.selectedPreset = await this.selectFramework(context);
    this.config = JSON.parse(JSON.stringify(this.selectedPreset.config));

    const steps = [
      { name: "Target", fn: () => this.configureTarget() },
      { name: "Module system", fn: () => this.configureModuleSystem() },
      {
        name: "Type-checking strictness",
        fn: () => this.configureStrictness(),
      },
      { name: "Path aliases", fn: () => this.configurePathAliases(context) },
      { name: "Type libraries", fn: () => this.configureLibraries() },
      {
        name: "Additional options",
        fn: () => this.configureAdditionalOptions(context),
      },
      { name: "File patterns", fn: () => this.configureFilePatterns(context) },
    ];

    prompts.log.info(chalk.cyan("\nSetup steps:"));
    steps.forEach((step, i) => {
      prompts.log.message(chalk.gray(`  ${i + 1}. ${step.name}`));
    });

    for (const step of steps) {
      const skip = await prompts.confirm({
        message: `Skip "${step.name}"?`,
        initialValue: false,
      });

      if (prompts.isCancel(skip)) {
        prompts.cancel("Setup canceled");
        throw new Error("Cancelled");
      }

      if (!skip) {
        await step.fn();
      }
    }

    return this.finalizeConfiguration();
  }

  private async selectPresetManually(
    context: ProjectContext,
  ): Promise<BuildResult> {
    const allPresets = Object.entries(FRAMEWORK_PRESETS).map(
      ([key, preset]) => ({
        value: key,
        label: preset.name,
        hint: preset.description,
      }),
    );

    const selectedKey = await prompts.select({
      message: "Select a preset",
      options: allPresets,
    });

    if (prompts.isCancel(selectedKey)) {
      prompts.cancel("Setup canceled");
      throw new Error("Cancelled");
    }

    this.selectedPreset = FRAMEWORK_PRESETS[selectedKey];
    this.presetKey = selectedKey;
    this.config = JSON.parse(JSON.stringify(this.selectedPreset.config));

    const customize = await prompts.confirm({
      message: "Would you like to customize the configuration?",
      initialValue: false,
    });

    if (!prompts.isCancel(customize) && customize) {
      await this.quickCustomize(context);
    }

    return this.finalizeConfiguration();
  }

  private async quickCustomize(context: ProjectContext): Promise<void> {
    const customOptions = await prompts.multiselect({
      message: "Select items to customize",
      options: [
        { value: "paths", label: "Path aliases (@/*, etc.)" },
        { value: "strict", label: "Type-checking strictness" },
        { value: "target", label: "Compilation target (ES2022, ES2020, etc.)" },
        {
          value: "output",
          label: "Output options (source maps, declarations, etc.)",
        },
      ],
      required: false,
    });

    if (prompts.isCancel(customOptions)) return;

    for (const option of customOptions) {
      switch (option) {
        case "paths":
          await this.configurePathAliases(context);
          break;
        case "strict":
          await this.configureStrictness();
          break;
        case "target":
          await this.configureTarget();
          break;
        case "output":
          await this.configureOutputOptions();
          break;
      }
    }
  }

  private async configureOutputOptions(): Promise<void> {
    const outputOptions = await prompts.multiselect({
      message: "Choose output options",
      options: [
        { value: "sourceMap", label: "Generate source maps" },
        { value: "declaration", label: "Emit declaration files (.d.ts)" },
        { value: "declarationMap", label: "Emit declaration source maps" },
        { value: "removeComments", label: "Remove comments" },
      ],
      initialValues: ["sourceMap"],
    });

    if (!prompts.isCancel(outputOptions)) {
      outputOptions.forEach((opt) => {
        this.config.compilerOptions[opt] = true;
      });
    }
  }

  private displayPresetDetails(preset: TSConfigPreset): void {
    const { compilerOptions } = preset.config;

    prompts.log.message(chalk.gray(`  • Target: ${compilerOptions.target}`));
    prompts.log.message(chalk.gray(`  • Module: ${compilerOptions.module}`));
    prompts.log.message(
      chalk.gray(
        `  • Strict mode: ${compilerOptions.strict ? "Enabled" : "Disabled"}`,
      ),
    );

    if (compilerOptions.jsx) {
      prompts.log.message(chalk.gray(`  • JSX: ${compilerOptions.jsx}`));
    }

    if (compilerOptions.paths) {
      prompts.log.message(
        chalk.gray(
          `  • Path aliases: ${Object.keys(compilerOptions.paths).join(", ")}`,
        ),
      );
    }

    if (preset.additionalFiles) {
      prompts.log.message(
        chalk.gray(
          `  • Additional files: ${Object.keys(preset.additionalFiles).join(
            ", ",
          )}`,
        ),
      );
    }
  }

  private async finalizeConfiguration(): Promise<BuildResult> {
    const preview = this.generatePreview();
    prompts.log.message("");
    prompts.log.info("📄 Final configuration preview:");
    prompts.log.message(chalk.gray(preview));

    const confirmed = await prompts.confirm({
      message: "Apply this configuration?",
      initialValue: true,
    });

    if (!confirmed || prompts.isCancel(confirmed)) {
      prompts.cancel("Setup canceled");
      throw new Error("Configuration cancelled");
    }

    if (this.selectedPreset.additionalFiles) {
      prompts.log.info(chalk.yellow("\n📝 Additional files to be created:"));
      Object.keys(this.selectedPreset.additionalFiles).forEach((file) => {
        prompts.log.message(chalk.gray(`  • ${file}`));
      });
    }

    prompts.outro(chalk.green("✅ TypeScript configuration completed!"));

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
      prompts.log.info(`Detected project type: ${chalk.cyan(detected?.name)}`);

      const useDetected = await prompts.confirm({
        message: `Use ${detected?.name} optimized settings?"`,
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
      message: "Customize the compilation target?",
      initialValue: false,
    });

    if (prompts.isCancel(customizeTarget) || !customizeTarget) {
      return;
    }

    prompts.log.step(chalk.cyan("🎯 Set compilation target"));

    prompts.log.info("Target versions & typical environments:");
    prompts.log.message(
      chalk.gray("  • ES2022: Node 16+, modern browsers (recommended)"),
    );
    prompts.log.message(
      chalk.gray("  • ES2020: Node 14+, browsers since ~2020"),
    );
    prompts.log.message(chalk.gray("  • ES2017: Broad compatibility"));
    prompts.log.message(chalk.gray("  • ES2015: Maximum compatibility"));

    const target = await prompts.select({
      message: "Choose ECMAScript target version",
      options: COMPILER_OPTIONS.targets,
    });

    if (!prompts.isCancel(target)) {
      this.config.compilerOptions.target = target;
      prompts.log.success(`Compilation target set to ${target}`);
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
    prompts.log.step(chalk.cyan("🔒 Set type-checking strictness"));

    prompts.log.info("Differences by strictness level:");
    prompts.log.message(
      chalk.gray("  • Strict: enable all strict checks (recommended)"),
    );
    prompts.log.message(
      chalk.gray("  • Moderate: balanced defaults for migrations"),
    );
    prompts.log.message(chalk.gray("  • Loose: minimal type checks"));
    prompts.log.message(chalk.gray("  • Custom: pick individual options"));

    const strictness = await prompts.select({
      message: "Choose strictness level",
      options: COMPILER_OPTIONS.strictness,
    });

    if (prompts.isCancel(strictness)) {
      prompts.cancel("Setup canceled");
      throw new Error("Cancelled");
    }

    if (strictness === "custom") {
      await this.configureCustomStrictness();
    } else {
      const strictnessSettings = {
        strict: { strict: true },
        moderate: {
          strict: false,
          noImplicitAny: true,
          strictNullChecks: true,
          strictFunctionTypes: true,
        },
        loose: {
          strict: false,
          noImplicitAny: false,
        },
      };

      const settings =
        strictnessSettings[strictness as keyof typeof strictnessSettings];
      if (settings) {
        this.config.compilerOptions = {
          ...this.config.compilerOptions,
          ...settings,
        };
      }
    }

    prompts.log.success(
      `${
        strictness === "strict"
          ? "Strict"
          : strictness === "moderate"
            ? "Moderate"
            : strictness === "loose"
              ? "Loose"
              : "Custom"
      } mode selected`,
    );
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
      message: "Would you like to set up path aliases? (e.g., @/components)",
      initialValue: true,
    });

    if (prompts.isCancel(hasAliases) || !hasAliases) {
      return;
    }

    prompts.log.step(chalk.cyan("📁 Configure path aliases"));

    const hasSrc = await fileExists(path.join(context.projectPath, "src"));

    prompts.log.info("Path aliases help shorten import paths:");
    prompts.log.message(
      chalk.gray("  • import Button from '@/components/Button'"),
    );
    prompts.log.message(chalk.gray("  • import { api } from '@/lib/api'"));

    const baseUrl = await prompts.select({
      message: "Choose base directory",
      options: [
        {
          value: ".",
          label: "Project root (.)",
          hint: "Resolve paths from the project root",
        },
        ...(hasSrc
          ? [
              {
                value: "./src",
                label: "Source directory (./src)",
                hint: "Resolve paths from the src folder",
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
          hint: "Alias per top-level folder",
        },
        { value: "custom", label: "Custom", hint: "Define your own aliases" },
        { value: "none", label: "Skip", hint: "No aliases" },
      ],
    });

    if (prompts.isCancel(aliasPresets) || aliasPresets === "none") {
      return;
    }

    const paths: Record<string, string[]> = {};

    if (aliasPresets === "simple") {
      paths["@/*"] = [baseUrl === "." ? "./src/*" : "./*"];
      prompts.log.success("@/* alias configured");
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
        prompts.log.success(`Configured ${defaultAliases.length} alias(es)`);
      }
    }

    if (aliasPresets === "custom" || aliasPresets === "structured") {
      const addCustom = await prompts.confirm({
        message: "Add custom aliases?",
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
                return "Alias pattern must include * for wildcard matching";
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
      prompts.log.info(
        `Configured ${Object.keys(paths).length} path alias(es) in total`,
      );
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
    context: ProjectContext,
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

  private async configureFilePatterns(_context: ProjectContext): Promise<void> {
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
