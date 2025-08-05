import * as prompts from "@clack/prompts";
import chalk from "chalk";
import type { ProjectContext } from "../../types/project.type.js";
import {
  ESLINT_V8_PRESETS,
  ESLINT_V9_PRESETS,
  ADDITIONAL_RULES,
  detectBestESLintPreset,
  type ESLintPreset,
} from "./presets.js";
import { 
  ConfigFormatDetector,
  type ProjectEnvironment 
} from "./config-format-detector.js";
import { fileExists } from "../../utils/file.js";
import path from "path";

export interface ESLintBuildResult {
  config: string;
  dependencies: Record<string, string>;
  additionalFiles?: Record<string, string>;
  presetKey: string | null;
  configType: "legacy" | "flat";
  configFileName: string;
}

export class ESLintConfigBuilder {
  private config: any = {};
  private selectedPreset: ESLintPreset | null = null;
  private presetKey: string | null = null;
  private dependencies: Record<string, string> = {};
  private configType: "legacy" | "flat" = "legacy";
  private configFileName: string = ".eslintrc.json";
  private projectEnvironment: ProjectEnvironment | null = null;
  private nonInteractive: boolean = false;

  async build(context: ProjectContext, nonInteractive: boolean = false): Promise<ESLintBuildResult> {
    this.nonInteractive = nonInteractive;
    
    if (nonInteractive) {
      return this.buildNonInteractive(context);
    }
    prompts.intro(chalk.blue("🔧 ESLint Configuration Setup"));

    // Detect project environment
    this.projectEnvironment = await ConfigFormatDetector.detectProjectEnvironment(context.projectPath);
    
    await this.checkExistingConfig(context);

    const eslintVersion = await prompts.select({
      message: "Which ESLint configuration format would you like to use?",
      options: [
        {
          value: "v9",
          label: "📦 ESLint v9 (Flat Config)",
          hint: "Modern flat config system - Recommended for new projects",
        },
        {
          value: "v8",
          label: "📋 ESLint v8 (Legacy)",
          hint: "Traditional .eslintrc format - Better for existing projects",
        },
      ],
    });

    if (prompts.isCancel(eslintVersion)) {
      prompts.cancel("Setup canceled");
      throw new Error("Configuration cancelled");
    }

    this.configType = eslintVersion === "v9" ? "flat" : "legacy";
    
    // Ask user about config file format preference
    await this.selectConfigFileFormat(eslintVersion);

    const setupMode = await prompts.select({
      message: "How would you like to set up ESLint?",
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
      throw new Error("Configuration cancelled");
    }

    if (setupMode === "quick") {
      await this.quickSetup(context);
    } else {
      await this.customSetup(context);
    }

    return await this.finalizeConfiguration();
  }

  private async buildNonInteractive(context: ProjectContext): Promise<ESLintBuildResult> {
    // Detect project environment
    this.projectEnvironment = await ConfigFormatDetector.detectProjectEnvironment(context.projectPath);
    
    // Auto-detect best configuration
    const detectedPresetKey = detectBestESLintPreset(context);
    
    // Choose ESLint version based on Node.js version or default to v9
    this.configType = "flat"; // Default to modern flat config
    
    // Select recommended config file format
    const recommended = ConfigFormatDetector.recommendESLintConfigFormat(
      this.projectEnvironment, 
      "v9"
    );
    this.configFileName = recommended.filename;
    
    // Use detected preset or fallback to a default
    const availablePresets = ESLINT_V9_PRESETS;
    const presetKey = detectedPresetKey || "standard";
    const preset = availablePresets[presetKey];
    
    if (preset) {
      this.selectedPreset = preset;
      this.presetKey = presetKey;
      this.config = JSON.parse(JSON.stringify(preset.config));
      this.dependencies = { ...preset.dependencies.devDependencies };
    }
    
    return await this.finalizeConfiguration();
  }

  private async quickSetup(context: ProjectContext): Promise<void> {
    const detectedPresetKey = detectBestESLintPreset(context);

    if (detectedPresetKey) {
      const availablePresets =
        this.configType === "flat" ? ESLINT_V9_PRESETS : ESLINT_V8_PRESETS;
      const preset = availablePresets[detectedPresetKey];
      if (!preset) {
        prompts.log.warning("Could not find the detected preset");
        return await this.selectPresetManually(context);
      }

      prompts.log.info(
        `\n🎯 Detected project type: ${chalk.cyan(preset.name)}`
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
        throw new Error("Configuration cancelled");
      }

      if (!useDetected) {
        prompts.log.info("Please select a different preset");
        return await this.selectPresetManually(context);
      }

      this.selectedPreset = preset;
      this.presetKey = detectedPresetKey;
      this.config = JSON.parse(JSON.stringify(preset.config));
      this.dependencies = { ...preset.dependencies.devDependencies };

      const customize = await prompts.confirm({
        message: "Would you like to add additional rules?",
        initialValue: false,
      });

      if (!prompts.isCancel(customize) && customize) {
        await this.addAdditionalRules();
      }
    } else {
      prompts.log.warning("Could not automatically detect the project type");
      return await this.selectPresetManually(context);
    }
  }

  private async customSetup(context: ProjectContext): Promise<void> {
    this.selectedPreset = await this.selectPreset(context);
    this.config = JSON.parse(JSON.stringify(this.selectedPreset.config));
    this.dependencies = { ...this.selectedPreset.dependencies.devDependencies };

    const steps = [
      { name: "Environment", fn: () => this.configureEnvironment() },
      {
        name: "Parser options",
        fn: () => this.configureParserOptions(context),
      },
      { name: "Rules", fn: () => this.configureRules() },
      { name: "Additional rules", fn: () => this.addAdditionalRules() },
      {
        name: "Ignore patterns",
        fn: () => this.configureIgnorePatterns(context),
      },
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
        throw new Error("Configuration cancelled");
      }

      if (!skip) {
        await step.fn();
      }
    }
  }

  private async selectPresetManually(context: ProjectContext): Promise<void> {
    this.selectedPreset = await this.selectPreset(context);
    this.config = JSON.parse(JSON.stringify(this.selectedPreset.config));
    this.dependencies = { ...this.selectedPreset.dependencies.devDependencies };

    const customize = await prompts.confirm({
      message: "Would you like to customize the configuration?",
      initialValue: false,
    });

    if (!prompts.isCancel(customize) && customize) {
      await this.addAdditionalRules();
    }
  }

  private async selectPreset(context: ProjectContext): Promise<ESLintPreset> {
    const detectedPresetKey = detectBestESLintPreset(context);
    const availablePresets =
      this.configType === "flat" ? ESLINT_V9_PRESETS : ESLINT_V8_PRESETS;

    if (detectedPresetKey) {
      const detected = availablePresets[detectedPresetKey];
      if (detected) {
        prompts.log.info(`Detected project type: ${chalk.cyan(detected.name)}`);

        const useDetected = await prompts.confirm({
          message: `Use ${detected.name} optimized settings?`,
          initialValue: true,
        });

        if (prompts.isCancel(useDetected)) {
          prompts.cancel("Setup cancelled");
          throw new Error("Configuration cancelled");
        }

        if (useDetected) {
          this.presetKey = detectedPresetKey;
          return detected;
        }
      }
    }

    const allPresets = Object.entries(availablePresets).map(
      ([key, preset]) => ({
        value: key,
        label: preset.name,
        hint: preset.description,
      })
    );

    const selectedKey = await prompts.select({
      message: "Select an ESLint preset",
      options: allPresets,
    });

    if (prompts.isCancel(selectedKey)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Configuration cancelled");
    }

    this.presetKey = selectedKey;
    const selectedPreset = availablePresets[selectedKey];
    if (!selectedPreset) {
      throw new Error(`Preset ${selectedKey} not found`);
    }
    return selectedPreset;
  }

  private async configureEnvironment(): Promise<void> {
    prompts.log.step(chalk.cyan("🌍 Configure Environment"));

    const environments = await prompts.multiselect({
      message: "Select environments",
      options: [
        { value: "browser", label: "Browser", hint: "window, document, etc." },
        {
          value: "node",
          label: "Node.js",
          hint: "global, process, Buffer, etc.",
        },
        {
          value: "es2021",
          label: "ES2021",
          hint: "Latest ECMAScript features",
        },
        { value: "jest", label: "Jest", hint: "Jest testing framework" },
        { value: "mocha", label: "Mocha", hint: "Mocha testing framework" },
      ],
      initialValues: Object.keys(this.config.env || {}),
    });

    if (!prompts.isCancel(environments)) {
      this.config.env = {};
      environments.forEach((env) => {
        this.config.env[env] = true;
      });
    }
  }

  private async configureParserOptions(context: ProjectContext): Promise<void> {
    prompts.log.step(chalk.cyan("⚙️ Configure Parser Options"));

    if (context.hasTypeScript) {
      const tsParserOptions = await prompts.multiselect({
        message: "TypeScript parser options",
        options: [
          { value: "jsx", label: "Enable JSX", hint: "For React projects" },
          {
            value: "project",
            label: "Type-aware linting",
            hint: "Uses tsconfig.json",
          },
        ],
        required: false,
      });

      if (!prompts.isCancel(tsParserOptions)) {
        if (!this.config.parserOptions) {
          this.config.parserOptions = {};
        }

        if (tsParserOptions.includes("jsx")) {
          this.config.parserOptions.ecmaFeatures = { jsx: true };
        }

        if (tsParserOptions.includes("project")) {
          this.config.parserOptions.project = "./tsconfig.json";
        }
      }
    }

    const ecmaVersion = await prompts.select({
      message: "ECMAScript version",
      options: [
        { value: "latest", label: "Latest", hint: "Use the latest version" },
        { value: 2022, label: "2022", hint: "ES2022 features" },
        { value: 2021, label: "2021", hint: "ES2021 features" },
        { value: 2020, label: "2020", hint: "ES2020 features" },
      ],
      initialValue: this.config.parserOptions?.ecmaVersion || "latest",
    });

    if (!prompts.isCancel(ecmaVersion)) {
      if (!this.config.parserOptions) {
        this.config.parserOptions = {};
      }
      this.config.parserOptions.ecmaVersion = ecmaVersion;
    }
  }

  private async configureRules(): Promise<void> {
    prompts.log.step(chalk.cyan("📏 Configure Rules"));

    const ruleCategories = await prompts.multiselect({
      message: "Select rule categories to customize",
      options: [
        {
          value: "errors",
          label: "Possible Errors",
          hint: "Catch bugs and errors",
        },
        {
          value: "best-practices",
          label: "Best Practices",
          hint: "Enforce best practices",
        },
        {
          value: "variables",
          label: "Variables",
          hint: "Variable declaration rules",
        },
        { value: "style", label: "Stylistic Issues", hint: "Code style rules" },
      ],
      required: false,
    });

    if (prompts.isCancel(ruleCategories)) return;

    for (const category of ruleCategories) {
      await this.configureRuleCategory(category);
    }
  }

  private async configureRuleCategory(category: string): Promise<void> {
    const rules: Record<string, any> = {};

    switch (category) {
      case "errors":
        const errorRules = await prompts.multiselect({
          message: "Error prevention rules",
          options: [
            { value: "no-console", label: "Disallow console statements" },
            { value: "no-debugger", label: "Disallow debugger statements" },
            { value: "no-unused-vars", label: "Disallow unused variables" },
          ],
          required: false,
        });

        if (!prompts.isCancel(errorRules)) {
          errorRules.forEach((rule) => {
            rules[rule] = "error";
          });
        }
        break;

      case "best-practices":
        const bestPracticeRules = await prompts.multiselect({
          message: "Best practice rules",
          options: [
            { value: "prefer-const", label: "Prefer const declarations" },
            { value: "no-var", label: "Disallow var declarations" },
            { value: "prefer-arrow-callback", label: "Prefer arrow functions" },
          ],
          required: false,
        });

        if (!prompts.isCancel(bestPracticeRules)) {
          bestPracticeRules.forEach((rule) => {
            rules[rule] = "error";
          });
        }
        break;
    }

    this.config.rules = { ...this.config.rules, ...rules };
  }

  private async addAdditionalRules(): Promise<void> {
    const ruleCategories = await prompts.multiselect({
      message: "Select additional rule categories",
      options: [
        {
          value: "strict",
          label: "Strict rules",
          hint: "Enforce stricter coding standards",
        },
        {
          value: "performance",
          label: "Performance rules",
          hint: "Optimize for performance",
        },
        { value: "style", label: "Style rules", hint: "Consistent code style" },
      ],
      required: false,
    });

    if (prompts.isCancel(ruleCategories)) return;

    for (const category of ruleCategories) {
      const categoryRules =
        ADDITIONAL_RULES[category as keyof typeof ADDITIONAL_RULES];
      if (categoryRules) {
        for (const ruleSet of categoryRules) {
          const applyRules = await prompts.confirm({
            message: `Apply ${ruleSet.name} rules?`,
            initialValue: false,
          });

          if (!prompts.isCancel(applyRules) && applyRules) {
            this.config.rules = { ...this.config.rules, ...ruleSet.rules };
          }
        }
      }
    }
  }

  private async configureIgnorePatterns(
    context: ProjectContext
  ): Promise<void> {
    const ignorePatterns = [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
    ];

    if (context.projectType === "next") {
      ignorePatterns.push(".next/", "next-env.d.ts");
    }

    if (context.projectType === "vite") {
      ignorePatterns.push(".vite/");
    }

    const customPatterns = await prompts.text({
      message: "Additional ignore patterns (comma-separated)",
      placeholder: "public/, docs/, *.config.js",
      validate: (value) => {
        if (!value) return undefined;
        return undefined;
      },
    });

    if (!prompts.isCancel(customPatterns) && customPatterns) {
      const patterns = customPatterns.split(",").map((p) => p.trim());
      ignorePatterns.push(...patterns);
    }

    this.selectedPreset!.additionalFiles = {
      ".eslintignore": ignorePatterns.join("\n") + "\n",
    };
  }

  private displayPresetDetails(preset: ESLintPreset): void {
    const { config } = preset;

    if (config.extends) {
      prompts.log.message(
        chalk.gray(
          `  • Extends: ${
            Array.isArray(config.extends)
              ? config.extends.join(", ")
              : config.extends
          }`
        )
      );
    }

    if (config.parser) {
      prompts.log.message(chalk.gray(`  • Parser: ${config.parser}`));
    }

    if (config.plugins) {
      prompts.log.message(
        chalk.gray(`  • Plugins: ${config.plugins.join(", ")}`)
      );
    }

    if (config.env) {
      prompts.log.message(
        chalk.gray(`  • Environment: ${Object.keys(config.env).join(", ")}`)
      );
    }

    const ruleCount = Object.keys(config.rules || {}).length;
    if (ruleCount > 0) {
      prompts.log.message(chalk.gray(`  • Custom rules: ${ruleCount}`));
    }
  }

  private async checkExistingConfig(context: ProjectContext): Promise<void> {
    const configFiles = [
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".eslintrc.yml",
      ".eslintrc.yaml",
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.ts",
    ];

    for (const file of configFiles) {
      const filePath = path.join(context.projectPath, file);
      if (await fileExists(filePath)) {
        prompts.log.warning(`Found existing ESLint config: ${file}`);

        const action = await prompts.select({
          message: "How would you like to proceed?",
          options: [
            {
              value: "replace",
              label: "Replace existing config",
              hint: "Overwrite with new configuration",
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
          throw new Error("Configuration cancelled");
        }
        break;
      }
    }
  }

  private async finalizeConfiguration(): Promise<ESLintBuildResult> {
    if (!this.nonInteractive) {
      const preview = this.generatePreview();
      prompts.log.message("");
      prompts.log.info("📄 Final configuration preview:");
      prompts.log.message(chalk.gray(preview));

      const confirmed = await prompts.confirm({
        message: "Apply this configuration?",
        initialValue: true,
      });

      if (prompts.isCancel(confirmed) || !confirmed) {
        prompts.cancel("Setup canceled");
        throw new Error("Configuration cancelled");
      }
    }

    if (!this.nonInteractive) {
      if (this.selectedPreset?.additionalFiles) {
        prompts.log.info(chalk.yellow("\n📝 Additional files to be created:"));
        Object.keys(this.selectedPreset.additionalFiles).forEach((file) => {
          prompts.log.message(chalk.gray(`  • ${file}`));
        });
      }

      prompts.outro(chalk.green("✅ ESLint configuration completed!"));
    }

    const configContent = this.generateConfigContent();

    return {
      config: configContent,
      dependencies: this.dependencies,
      additionalFiles: this.selectedPreset?.additionalFiles,
      presetKey: this.presetKey,
      configType: this.configType,
      configFileName: this.configFileName,
    };
  }

  private generateFlatConfig(): string {
    const extension = this.configFileName.split('.').pop() || 'js';
    
    const imports = new Set<string>();
    const configObjects: any[] = [];

    // Add imports based on file type
    if (extension === 'ts') {
      imports.add(`import { defineConfig } from "eslint/config";`);
    } else {
      imports.add(`import { defineConfig } from "eslint/config";`);
    }

    if (this.config.env?.browser || this.config.env?.node) {
      imports.add(`import globals from "globals";`);
    }

    if (this.config.parser === "@typescript-eslint/parser") {
      imports.add(`import tseslint from "@typescript-eslint/eslint-plugin";`);
      imports.add(`import tsParser from "@typescript-eslint/parser";`);
    }

    if (this.config.plugins?.includes("react")) {
      imports.add(`import react from "eslint-plugin-react";`);
    }

    if (this.config.plugins?.includes("react-hooks")) {
      imports.add(`import reactHooks from "eslint-plugin-react-hooks";`);
    }

    const baseConfig: any = {
      files: ["**/*.{js,jsx,ts,tsx}"],
      languageOptions: {},
    };

    if (this.config.env) {
      const globalTypes: string[] = [];
      if (this.config.env.browser) globalTypes.push("globals.browser");
      if (this.config.env.node) globalTypes.push("globals.node");
      if (this.config.env.es2021) globalTypes.push("globals.es2021");

      if (globalTypes.length > 0) {
        baseConfig.languageOptions.globals = `{...${globalTypes.join(", ...")}}`;
      }
    }

    if (this.config.parser === "@typescript-eslint/parser") {
      baseConfig.languageOptions.parser = "tsParser";
      if (this.config.parserOptions) {
        baseConfig.languageOptions.parserOptions = this.config.parserOptions;
      }
    }

    if (this.config.plugins?.length > 0) {
      baseConfig.plugins = {};
      this.config.plugins.forEach((plugin: string) => {
        switch (plugin) {
          case "@typescript-eslint":
            baseConfig.plugins["@typescript-eslint"] = "tseslint";
            break;
          case "react":
            baseConfig.plugins.react = "react";
            break;
          case "react-hooks":
            baseConfig.plugins["react-hooks"] = "reactHooks";
            break;
          default:
            baseConfig.plugins[plugin] = plugin;
        }
      });
    }

    if (this.config.rules) {
      baseConfig.rules = this.config.rules;
    }

    configObjects.push(baseConfig);

    const importsString = Array.from(imports).join("\n");
    const configString = this.formatFlatConfigObject(configObjects);

    // Generate based on file extension
    switch (extension) {
      case 'mjs':
        return `${importsString}

export default defineConfig([
${configString}
]);`;
      
      case 'cjs':
        return this.generateFlatConfigCJS(configObjects);
      
      case 'ts':
        return `${importsString}

export default defineConfig([
${configString}
]);`;
      
      case 'js':
      default:
        return `${importsString}

export default defineConfig([
${configString}
]);`;
    }
  }

  private generateFlatConfigCJS(configObjects: any[]): string {
    // Convert imports to require statements
    const requires: string[] = [];
    
    requires.push(`const { defineConfig } = require("eslint/config");`);
    
    if (this.config.env?.browser || this.config.env?.node) {
      requires.push(`const globals = require("globals");`);
    }

    if (this.config.parser === "@typescript-eslint/parser") {
      requires.push(`const tseslint = require("@typescript-eslint/eslint-plugin");`);
      requires.push(`const tsParser = require("@typescript-eslint/parser");`);
    }

    if (this.config.plugins?.includes("react")) {
      requires.push(`const react = require("eslint-plugin-react");`);
    }

    if (this.config.plugins?.includes("react-hooks")) {
      requires.push(`const reactHooks = require("eslint-plugin-react-hooks");`);
    }

    const requiresString = requires.join("\n");
    const configString = this.formatFlatConfigObject(configObjects);

    return `${requiresString}

module.exports = defineConfig([
${configString}
]);`;
  }

  private formatFlatConfigObject(configObjects: any[]): string {
    return configObjects
      .map((config) => {
        let configString = JSON.stringify(config, null, 2);
        
        // Fix globals to be proper JavaScript object syntax instead of string
        configString = configString.replace(
          /"globals":\s*"([^"]+)"/g,
          '"globals": $1'
        );
        
        // Fix parser reference to be variable instead of string
        configString = configString.replace(
          /"parser":\s*"tsParser"/g,
          '"parser": tsParser'
        );
        
        // Fix plugin references to be variables instead of strings
        configString = configString.replace(
          /"@typescript-eslint":\s*"tseslint"/g,
          '"@typescript-eslint": tseslint'
        );
        configString = configString.replace(
          /"react":\s*"react"/g,
          '"react": react'
        );
        configString = configString.replace(
          /"react-hooks":\s*"reactHooks"/g,
          '"react-hooks": reactHooks'
        );
        
        const lines = configString
          .split("\n")
          .map((line, index) => {
            if (index === 0) return `  ${line}`;
            return `  ${line}`;
          })
          .join("\n");
        return lines;
      })
      .join(",\n");
  }

  private generateConfigContent(): string {
    const extension = this.configFileName.split('.').pop() || 'json';
    
    if (this.configType === "flat") {
      return this.generateFlatConfig();
    } else {
      // Legacy config
      switch (extension) {
        case 'js':
        case 'cjs':
          return this.generateLegacyJSConfig(extension === 'cjs');
        case 'yml':
        case 'yaml':
          return this.generateLegacyYAMLConfig();
        case 'json':
        default:
          return JSON.stringify(this.config, null, 2);
      }
    }
  }

  private generateLegacyJSConfig(isCommonJS: boolean = false): string {
    const configStr = JSON.stringify(this.config, null, 2)
      .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
      .replace(/"/g, "'"); // Use single quotes
    
    if (isCommonJS) {
      return `module.exports = ${configStr};`;
    } else {
      return `export default ${configStr};`;
    }
  }

  private generateLegacyYAMLConfig(): string {
    const yamlLines: string[] = [];
    
    const addYAMLSection = (key: string, value: any, indent: number = 0) => {
      const spaces = '  '.repeat(indent);
      
      if (Array.isArray(value)) {
        yamlLines.push(`${spaces}${key}:`);
        value.forEach(item => {
          yamlLines.push(`${spaces}  - ${typeof item === 'string' ? item : JSON.stringify(item)}`);
        });
      } else if (typeof value === 'object' && value !== null) {
        yamlLines.push(`${spaces}${key}:`);
        Object.entries(value).forEach(([subKey, subValue]) => {
          addYAMLSection(subKey, subValue, indent + 1);
        });
      } else {
        yamlLines.push(`${spaces}${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      }
    };

    Object.entries(this.config).forEach(([key, value]) => {
      addYAMLSection(key, value);
    });

    return yamlLines.join('\n');
  }

  private generatePreview(): string {
    const preview = this.generateConfigContent();
    const lines = preview.split("\n");
    const maxLines = 30;

    if (lines.length <= maxLines) {
      return preview;
    }

    return lines.slice(0, maxLines).join("\n") + "\n...";
  }

  private async selectConfigFileFormat(eslintVersion: "v8" | "v9"): Promise<void> {
    if (!this.projectEnvironment) {
      throw new Error("Project environment not detected");
    }

    // Get recommended format
    const recommended = ConfigFormatDetector.recommendESLintConfigFormat(
      this.projectEnvironment, 
      eslintVersion
    );

    // Show recommendation
    prompts.log.info(`\n💡 Recommended format: ${chalk.cyan(recommended.filename)}`);
    prompts.log.message(chalk.gray(`   ${recommended.reason}`));

    const useRecommended = await prompts.confirm({
      message: `Use recommended format (${recommended.filename})?`,
      initialValue: true,
    });

    if (prompts.isCancel(useRecommended)) {
      prompts.cancel("Setup canceled");
      throw new Error("Configuration cancelled");
    }

    if (useRecommended) {
      this.configFileName = recommended.filename;
      return;
    }

    // Show all available formats
    const availableFormats = ConfigFormatDetector.getAvailableESLintFormats(eslintVersion);
    const formatOptions = availableFormats.map(format => ({
      value: format.filename,
      label: `${format.filename} (${format.extension.toUpperCase()})`,
      hint: format.description
    }));

    const selectedFormat = await prompts.select({
      message: "Choose a configuration file format:",
      options: formatOptions,
    });

    if (prompts.isCancel(selectedFormat)) {
      prompts.cancel("Setup canceled");
      throw new Error("Configuration cancelled");
    }

    this.configFileName = selectedFormat;

    // Show details about selected format
    const selectedFormatDetails = availableFormats.find(f => f.filename === selectedFormat);
    if (selectedFormatDetails) {
      prompts.log.message(`\n✅ Selected: ${chalk.cyan(selectedFormat)}`);
      prompts.log.message(chalk.green(`   Pros: ${selectedFormatDetails.pros.join(", ")}`));
      if (selectedFormatDetails.cons.length > 0) {
        prompts.log.message(chalk.yellow(`   Cons: ${selectedFormatDetails.cons.join(", ")}`));
      }
    }
  }
}
