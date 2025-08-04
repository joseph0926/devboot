import * as prompts from "@clack/prompts";
import chalk from "chalk";
import type { ProjectContext } from "../../types/project.type.js";
import { fileExists } from "../../utils/file.js";
import path from "path";

export interface PrettierConfig {
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "none" | "es5" | "all";
  tabWidth: number;
  useTabs: boolean;
  printWidth: number;
  endOfLine: "lf" | "crlf" | "cr" | "auto";
  jsxSingleQuote?: boolean;
  arrowParens?: "always" | "avoid";
  bracketSpacing?: boolean;
  embeddedLanguageFormatting?: "auto" | "off";
  htmlWhitespaceSensitivity?: "css" | "strict" | "ignore";
  insertPragma?: boolean;
  jsxBracketSameLine?: boolean;
  proseWrap?: "always" | "never" | "preserve";
  quoteProps?: "as-needed" | "consistent" | "preserve";
  requirePragma?: boolean;
  vueIndentScriptAndStyle?: boolean;
  parser?: string;
}

export const PRETTIER_PRESETS = {
  standard: {
    name: "Standard",
    description: "Widely adopted defaults",
    config: {
      semi: true,
      singleQuote: true,
      trailingComma: "es5",
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      endOfLine: "lf",
      arrowParens: "always",
      bracketSpacing: true,
    },
  },
  prettier: {
    name: "Prettier Default",
    description: "Official Prettier defaults",
    config: {
      semi: true,
      singleQuote: false,
      trailingComma: "all",
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      endOfLine: "lf",
      arrowParens: "always",
      bracketSpacing: true,
    },
  },
  airbnb: {
    name: "Airbnb Style",
    description: "Airbnb JavaScript style guide compatible",
    config: {
      semi: true,
      singleQuote: true,
      trailingComma: "es5",
      tabWidth: 2,
      useTabs: false,
      printWidth: 100,
      endOfLine: "lf",
      arrowParens: "avoid",
      bracketSpacing: true,
    },
  },
  google: {
    name: "Google Style",
    description: "Google JavaScript style guide compatible",
    config: {
      semi: true,
      singleQuote: true,
      trailingComma: "es5",
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      endOfLine: "lf",
      arrowParens: "always",
      bracketSpacing: false,
    },
  },
  compact: {
    name: "Compact",
    description: "More compact formatting",
    config: {
      semi: false,
      singleQuote: true,
      trailingComma: "none",
      tabWidth: 2,
      useTabs: false,
      printWidth: 120,
      endOfLine: "lf",
      arrowParens: "avoid",
      bracketSpacing: false,
    },
  },
} as const;

export class PrettierConfigBuilder {
  private config: PrettierConfig = {
    semi: true,
    singleQuote: true,
    trailingComma: "es5",
    tabWidth: 2,
    useTabs: false,
    printWidth: 80,
    endOfLine: "lf",
  };

  async build(context: ProjectContext): Promise<string> {
    prompts.intro(chalk.blue("🎨 Prettier Configuration Setup"));

    await this.checkExistingConfig(context);

    const setupMode = await prompts.select({
      message: "How would you like to configure Prettier?",
      options: [
        {
          value: "preset",
          label: "🚀 Use preset",
          hint: "Choose from popular style guides",
        },
        {
          value: "interactive",
          label: "🛠️  Interactive setup",
          hint: "Configure each option step by step",
        },
        {
          value: "detect",
          label: "🔍 Auto-detect",
          hint: "Detect settings from existing code",
        },
      ],
    });

    if (prompts.isCancel(setupMode)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Configuration cancelled");
    }

    switch (setupMode) {
      case "preset":
        await this.presetSetup(context);
        break;
      case "interactive":
        await this.interactiveSetup(context);
        break;
      case "detect":
        await this.detectSetup(context);
        break;
    }

    return this.finalizeConfiguration();
  }

  private async presetSetup(context: ProjectContext): Promise<void> {
    prompts.log.step(chalk.cyan("Choose a Prettier preset"));

    const presetOptions = Object.entries(PRETTIER_PRESETS).map(
      ([key, preset]) => ({
        value: key,
        label: preset.name,
        hint: preset.description,
      }),
    );

    const selectedPreset = await prompts.select({
      message: "Select a style preset",
      options: presetOptions,
    });

    if (prompts.isCancel(selectedPreset)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Configuration cancelled");
    }

    const preset =
      PRETTIER_PRESETS[selectedPreset as keyof typeof PRETTIER_PRESETS];
    this.config = { ...this.config, ...preset.config };

    const showPreview = await prompts.confirm({
      message: "Would you like to see the configuration details?",
      initialValue: false,
    });

    if (!prompts.isCancel(showPreview) && showPreview) {
      this.displayConfigPreview();
    }

    await this.applyProjectSpecificSettings(context);

    const customize = await prompts.confirm({
      message: "Would you like to customize any settings?",
      initialValue: false,
    });

    if (!prompts.isCancel(customize) && customize) {
      await this.quickCustomize();
    }
  }

  private async interactiveSetup(context: ProjectContext): Promise<void> {
    prompts.log.step(chalk.cyan("Interactive Prettier Configuration"));

    await this.configureSemicolons();
    await this.configureQuotes();
    await this.configureTrailingCommas();
    await this.configureIndentation();
    await this.configurePrintWidth();
    await this.configureLineEndings();
    await this.configureArrowParens();
    await this.configureBracketSpacing();

    if (
      context.projectType === "react" ||
      context.projectType === "next" ||
      context.projectType === "vite"
    ) {
      await this.configureJsxOptions();
    }

    await this.configureAdvancedOptions();
  }

  private async detectSetup(context: ProjectContext): Promise<void> {
    prompts.log.step(chalk.cyan("Auto-detecting settings from codebase"));

    const analysis = await this.analyzeExistingCode(context);

    if (analysis.files === 0) {
      prompts.log.warning("No JavaScript/TypeScript files found for analysis");
      return this.presetSetup(context);
    }

    prompts.log.info(`Analyzed ${analysis.files} files`);

    this.config = {
      ...this.config,
      ...analysis.detectedConfig,
    };

    this.displayDetectedSettings(analysis);

    const confirm = await prompts.confirm({
      message: "Apply these detected settings?",
      initialValue: true,
    });

    if (prompts.isCancel(confirm) || !confirm) {
      return this.presetSetup(context);
    }

    await this.applyProjectSpecificSettings(context);
  }

  private async analyzeExistingCode(context: ProjectContext): Promise<{
    files: number;
    detectedConfig: Partial<PrettierConfig>;
  }> {
    const { readdir, readFile, stat } = await import("fs/promises");

    let totalFiles = 0;
    let semiCount = 0;
    let noSemiCount = 0;
    let singleQuoteCount = 0;
    let doubleQuoteCount = 0;
    let tabCount = 0;
    let spaceCount = 0;
    let tabWidthSum = 0;
    let tabWidthCount = 0;

    const analyzeFile = async (filePath: string): Promise<void> => {
      try {
        const content = await readFile(filePath, "utf-8");
        const lines = content.split("\n");

        totalFiles++;

        for (const line of lines) {
          if (line.trim().endsWith(";")) semiCount++;
          if (line.includes("';") || line.includes("`;")) singleQuoteCount++;
          if (line.includes('";') || line.includes("`;")) doubleQuoteCount++;

          if (line.startsWith("\t")) {
            tabCount++;
          } else if (line.match(/^  +/)) {
            spaceCount++;
            const match = line.match(/^( +)/);
            const spaces = match?.[1]?.length || 0;
            if (spaces > 0 && spaces % 2 === 0) {
              tabWidthSum += spaces;
              tabWidthCount++;
            }
          }
        }
      } catch (error) {}
    };

    const scanDirectory = async (dirPath: string): Promise<void> => {
      try {
        const entries = await readdir(dirPath);

        for (const entry of entries) {
          if (entry.startsWith(".") || entry === "node_modules") continue;

          const fullPath = path.join(dirPath, entry);
          const stats = await stat(fullPath);

          if (stats.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
            await analyzeFile(fullPath);
          }
        }
      } catch (error) {}
    };

    await scanDirectory(context.projectPath);

    const detectedConfig: Partial<PrettierConfig> = {};

    if (semiCount + noSemiCount > 0) {
      detectedConfig.semi = semiCount > noSemiCount;
    }

    if (singleQuoteCount + doubleQuoteCount > 0) {
      detectedConfig.singleQuote = singleQuoteCount > doubleQuoteCount;
    }

    if (tabCount + spaceCount > 0) {
      detectedConfig.useTabs = tabCount > spaceCount;

      if (!detectedConfig.useTabs && tabWidthCount > 0) {
        const avgTabWidth = Math.round(tabWidthSum / tabWidthCount);
        if ([2, 4, 8].includes(avgTabWidth)) {
          detectedConfig.tabWidth = avgTabWidth;
        }
      }
    }

    return {
      files: totalFiles,
      detectedConfig,
    };
  }

  private displayDetectedSettings(analysis: any): void {
    prompts.log.info("Detected settings:");
    Object.entries(analysis.detectedConfig).forEach(([key, value]) => {
      prompts.log.message(chalk.gray(`  • ${key}: ${value}`));
    });
  }

  private async configureSemicolons(): Promise<void> {
    const semi = await prompts.confirm({
      message: "Use semicolons?",
      initialValue: true,
    });

    if (!prompts.isCancel(semi)) {
      this.config.semi = semi;
    }
  }

  private async configureQuotes(): Promise<void> {
    const quotes = await prompts.select({
      message: "Quote style",
      options: [
        { value: true, label: "Single quotes (')", hint: "More common in JS" },
        { value: false, label: 'Double quotes (")', hint: "JSON compatible" },
      ],
    });

    if (!prompts.isCancel(quotes)) {
      this.config.singleQuote = quotes;
    }
  }

  private async configureTrailingCommas(): Promise<void> {
    const trailingComma = await prompts.select({
      message: "Trailing commas",
      options: [
        { value: "es5", label: "ES5", hint: "Objects, arrays (recommended)" },
        { value: "all", label: "All", hint: "All valid ES5/ES2015 locations" },
        { value: "none", label: "None", hint: "No trailing commas" },
      ],
    });

    if (!prompts.isCancel(trailingComma)) {
      this.config.trailingComma = trailingComma;
    }
  }

  private async configureIndentation(): Promise<void> {
    const useTabs = await prompts.select({
      message: "Indentation style",
      options: [
        { value: false, label: "Spaces", hint: "Use spaces for indentation" },
        { value: true, label: "Tabs", hint: "Use tabs for indentation" },
      ],
    });

    if (!prompts.isCancel(useTabs)) {
      this.config.useTabs = useTabs;

      if (!useTabs) {
        const tabWidth = await prompts.select({
          message: "Tab width (spaces)",
          options: [
            { value: 2, label: "2 spaces" },
            { value: 4, label: "4 spaces" },
            { value: 8, label: "8 spaces" },
          ],
        });

        if (!prompts.isCancel(tabWidth)) {
          this.config.tabWidth = tabWidth;
        }
      }
    }
  }

  private async configurePrintWidth(): Promise<void> {
    const printWidth = await prompts.select({
      message: "Line width",
      options: [
        { value: 80, label: "80 characters", hint: "Standard" },
        { value: 100, label: "100 characters", hint: "Modern screens" },
        { value: 120, label: "120 characters", hint: "Wide screens" },
      ],
    });

    if (!prompts.isCancel(printWidth)) {
      this.config.printWidth = printWidth;
    }
  }

  private async configureLineEndings(): Promise<void> {
    const endOfLine = await prompts.select({
      message: "Line endings",
      options: [
        { value: "lf", label: "LF (\\n)", hint: "Unix/Linux/macOS" },
        { value: "crlf", label: "CRLF (\\r\\n)", hint: "Windows" },
        { value: "auto", label: "Auto", hint: "Maintain existing" },
      ],
    });

    if (!prompts.isCancel(endOfLine)) {
      this.config.endOfLine = endOfLine;
    }
  }

  private async configureArrowParens(): Promise<void> {
    const arrowParens = await prompts.select({
      message: "Arrow function parentheses",
      options: [
        { value: "always", label: "Always", hint: "(x) => x" },
        { value: "avoid", label: "Avoid", hint: "x => x" },
      ],
    });

    if (!prompts.isCancel(arrowParens)) {
      this.config.arrowParens = arrowParens;
    }
  }

  private async configureBracketSpacing(): Promise<void> {
    const bracketSpacing = await prompts.confirm({
      message: "Bracket spacing in objects?",
      initialValue: true,
    });

    if (!prompts.isCancel(bracketSpacing)) {
      this.config.bracketSpacing = bracketSpacing;
    }
  }

  private async configureJsxOptions(): Promise<void> {
    prompts.log.step(chalk.cyan("JSX Options"));

    const jsxSingleQuote = await prompts.confirm({
      message: "Use single quotes in JSX?",
      initialValue: true,
    });

    if (!prompts.isCancel(jsxSingleQuote)) {
      this.config.jsxSingleQuote = jsxSingleQuote;
    }

    const jsxBracketSameLine = await prompts.confirm({
      message: "Put closing bracket on same line?",
      initialValue: false,
    });

    if (!prompts.isCancel(jsxBracketSameLine)) {
      this.config.jsxBracketSameLine = jsxBracketSameLine;
    }
  }

  private async configureAdvancedOptions(): Promise<void> {
    const configureAdvanced = await prompts.confirm({
      message: "Configure advanced options?",
      initialValue: false,
    });

    if (prompts.isCancel(configureAdvanced) || !configureAdvanced) {
      return;
    }

    prompts.log.step(chalk.cyan("Advanced Options"));

    const htmlWhitespaceSensitivity = await prompts.select({
      message: "HTML whitespace sensitivity",
      options: [
        { value: "css", label: "CSS", hint: "Respect CSS display property" },
        {
          value: "strict",
          label: "Strict",
          hint: "All whitespace is significant",
        },
        {
          value: "ignore",
          label: "Ignore",
          hint: "All whitespace is insignificant",
        },
      ],
    });

    if (!prompts.isCancel(htmlWhitespaceSensitivity)) {
      this.config.htmlWhitespaceSensitivity = htmlWhitespaceSensitivity;
    }

    const proseWrap = await prompts.select({
      message: "Prose wrap",
      options: [
        {
          value: "preserve",
          label: "Preserve",
          hint: "Respect existing line breaks",
        },
        { value: "always", label: "Always", hint: "Wrap at print width" },
        { value: "never", label: "Never", hint: "Don't wrap" },
      ],
    });

    if (!prompts.isCancel(proseWrap)) {
      this.config.proseWrap = proseWrap;
    }
  }

  private async quickCustomize(): Promise<void> {
    const customOptions = await prompts.multiselect({
      message: "What would you like to customize?",
      options: [
        { value: "quotes", label: "Quote style" },
        { value: "semi", label: "Semicolons" },
        { value: "indent", label: "Indentation" },
        { value: "width", label: "Line width" },
        { value: "commas", label: "Trailing commas" },
        { value: "parens", label: "Arrow function parentheses" },
      ],
      required: false,
    });

    if (prompts.isCancel(customOptions)) return;

    for (const option of customOptions) {
      switch (option) {
        case "quotes":
          await this.configureQuotes();
          break;
        case "semi":
          await this.configureSemicolons();
          break;
        case "indent":
          await this.configureIndentation();
          break;
        case "width":
          await this.configurePrintWidth();
          break;
        case "commas":
          await this.configureTrailingCommas();
          break;
        case "parens":
          await this.configureArrowParens();
          break;
      }
    }
  }

  private async applyProjectSpecificSettings(
    context: ProjectContext,
  ): Promise<void> {
    if (
      context.projectType === "react" ||
      context.projectType === "next" ||
      context.projectType === "vite"
    ) {
      if (this.config.jsxSingleQuote === undefined) {
        this.config.jsxSingleQuote = this.config.singleQuote;
      }
    }

    if (context.hasTypeScript) {
      this.config.parser = "typescript" as any;
    }
  }

  private async checkExistingConfig(context: ProjectContext): Promise<void> {
    const configFiles = [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.js",
      "prettier.config.js",
    ];

    for (const file of configFiles) {
      const configPath = path.join(context.projectPath, file);
      if (await fileExists(configPath)) {
        prompts.log.warning(`Found existing ${file}`);

        const action = await prompts.select({
          message: "How would you like to proceed?",
          options: [
            {
              value: "merge",
              label: "Merge with existing",
              hint: "Keep custom settings, update defaults",
            },
            {
              value: "replace",
              label: "Replace entirely",
              hint: "Start fresh",
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

        if (action === "merge") {
          await this.loadExistingConfig(configPath);
        }

        break;
      }
    }
  }

  private async loadExistingConfig(configPath: string): Promise<void> {
    try {
      const { readFile } = await import("fs/promises");
      const content = await readFile(configPath, "utf-8");

      let existingConfig: any = {};

      if (configPath.endsWith(".json") || configPath.endsWith(".prettierrc")) {
        existingConfig = JSON.parse(content);
      } else if (configPath.endsWith(".js")) {
        const module = await import(configPath);
        existingConfig = module.default || module;
      }

      this.config = { ...this.config, ...existingConfig };
      prompts.log.success("Loaded existing configuration");
    } catch (error) {
      prompts.log.warning("Could not load existing configuration");
    }
  }

  private displayConfigPreview(): void {
    prompts.log.message("\n📋 Configuration preview:");
    Object.entries(this.config).forEach(([key, value]) => {
      prompts.log.message(chalk.gray(`  ${key}: ${JSON.stringify(value)}`));
    });
  }

  private async finalizeConfiguration(): Promise<string> {
    const preview = JSON.stringify(this.config, null, 2);
    prompts.log.message("");
    prompts.log.info("📄 Final Prettier configuration:");
    prompts.log.message(chalk.gray(preview));

    const confirmed = await prompts.confirm({
      message: "Apply this configuration?",
      initialValue: true,
    });

    if (!confirmed || prompts.isCancel(confirmed)) {
      prompts.cancel("Configuration cancelled");
      throw new Error("Configuration cancelled");
    }

    prompts.outro(chalk.green("✅ Prettier configuration complete!"));

    return JSON.stringify(this.config, null, 2);
  }
}
