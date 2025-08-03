import {
  BaseModule,
  type InstallOptions,
  type ValidationResult,
  type FileModifier,
  type InstallResult,
} from "../base.module.js";
import { fileExists } from "../../utils/file.js";
import path from "path";
import { SimpleLogicError } from "../../errors/logic.error.js";
import { LogicErrorCodes } from "../../types/error.type.js";
import { logger } from "../../utils/logger.js";
import { BaseError } from "../../errors/base.error.js";
import { TypeScriptConfigBuilder } from "./builder.js";
import { TSConfigAnalyzer } from "./analyzer.js";
import { detectBestPreset, FRAMEWORK_PRESETS } from "./presets.js";

export class TypeScriptModule extends BaseModule {
  private generatedConfig?: string;
  private additionalFiles?: Record<string, string>;

  constructor() {
    super({
      name: "typescript",
      displayName: "TypeScript",
      description:
        "TypeScript configuration with framework-specific optimizations",
      detectFiles: ["tsconfig.json"],
      conflicts: [],
      version: "1.0.0",
    });
  }

  async isInstalled(projectPath: string): Promise<boolean> {
    try {
      return await fileExists(path.join(projectPath, "tsconfig.json"));
    } catch (error) {
      return false;
    }
  }

  async validate(options: InstallOptions): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    try {
      const isInstalled = await this.isInstalled(options.projectPath);

      if (isInstalled && !options.force) {
        const analyzer = new TSConfigAnalyzer();
        const existingConfig = await analyzer.analyze(options.projectPath);

        if (existingConfig.isValid) {
          result.warnings.push(
            "tsconfig.json already exists. Use --force to reconfigure or we'll merge with existing settings."
          );

          if (existingConfig.warnings.length > 0) {
            result.warnings.push(...existingConfig.warnings);
          }
        }
      }

      const hasTypeScript =
        options.packageJson.dependencies?.typescript ||
        options.packageJson.devDependencies?.typescript;

      if (!hasTypeScript) {
        result.warnings.push(
          "TypeScript not found in dependencies. It will be installed."
        );
      }

      return result;
    } catch (error) {
      result.valid = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      result.errors.push(`Validation failed: ${errorMessage}`);
      return result;
    }
  }

  async getDependencies(options: InstallOptions): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }> {
    const deps: Record<string, string> = {
      typescript: "^5.8.3",
      "@types/node": "^24.0.0",
    };

    if (options.projectType === "next") {
      deps["@types/react"] = "^19.0.0";
      deps["@types/react-dom"] = "^19.0.0";
    } else if (
      options.projectType === "vite" &&
      options.packageJson.dependencies?.react
    ) {
      deps["@types/react"] = "^19.0.0";
      deps["@types/react-dom"] = "^19.0.0";
      if (options.packageJson.dependencies?.["@vitejs/plugin-react"]) {
        deps["vite"] = "^5.0.0";
      }
    } else if (options.projectType === "react") {
      const reactVersion = options.packageJson.dependencies?.react;
      if (reactVersion) {
        const majorVersion = reactVersion.match(/\d+/)?.[0];
        if (majorVersion) {
          deps["@types/react"] = `^${majorVersion}.0.0`;
          deps["@types/react-dom"] = `^${majorVersion}.0.0`;
        }
      }
    }

    if (options.packageJson.dependencies?.express) {
      deps["@types/express"] = "^5.0.0";
    }

    return { devDependencies: deps };
  }

  async getFilesToCreate(
    options: InstallOptions
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      let config: string;
      let presetKey: string | null = null;

      if (!options.dryRun && !this.generatedConfig) {
        const builder = new TypeScriptConfigBuilder();
        try {
          const result = await builder.build(options);
          this.generatedConfig = result.config;
          this.additionalFiles = result.additionalFiles;
          presetKey = result.presetKey;
          config = this.generatedConfig;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Configuration cancelled"
          ) {
            throw new SimpleLogicError(
              LogicErrorCodes.USER_CANCELLED,
              "TypeScript setup cancelled by user",
              false
            );
          }
          throw error;
        }
      } else if (this.generatedConfig) {
        config = this.generatedConfig;
      } else {
        config = await this.generateDefaultConfig(options);
      }

      files.set("tsconfig.json", config);

      if (this.additionalFiles) {
        for (const [fileName, content] of Object.entries(
          this.additionalFiles
        )) {
          files.set(fileName, content);
        }
      }

      if (options.projectType === "next") {
        const nextEnvPath = path.join(options.projectPath, "next-env.d.ts");
        if (!(await fileExists(nextEnvPath))) {
          files.set(
            "next-env.d.ts",
            '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.\n'
          );
        }
      }

      if (options.projectType === "vite") {
        const viteEnvPath = path.join(options.projectPath, "src/vite-env.d.ts");
        if (!(await fileExists(viteEnvPath))) {
          files.set(
            "src/vite-env.d.ts",
            '/// <reference types="vite/client" />\n'
          );
        }
      }

      return files;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_GENERATION_FAILED,
        "Failed to generate TypeScript configuration",
        false,
        {
          module: this.name,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  async getFilesToModify(): Promise<Map<string, FileModifier>> {
    const modifiers = new Map<string, FileModifier>();

    return modifiers;
  }

  private async generateDefaultConfig(
    options: InstallOptions
  ): Promise<string> {
    const presetKey = detectBestPreset(options);
    const preset = FRAMEWORK_PRESETS[presetKey || "node-commonjs"];

    if (options.verbose) {
      logger.info(`Using ${preset.name} preset for TypeScript configuration`);
    }

    return JSON.stringify(preset.config, null, 2);
  }

  async uninstall(options: InstallOptions): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      errors: [],
      hints: [],
    };

    try {
      const configPath = path.join(options.projectPath, "tsconfig.json");

      if (!(await fileExists(configPath))) {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_NOT_FOUND,
          "tsconfig.json not found",
          false,
          { path: configPath }
        );
      }

      const additionalFiles = [
        "tsconfig.node.json",
        "tsconfig.app.json",
        "tsconfig.lib.json",
      ];

      const filesToRemove = [configPath];

      for (const file of additionalFiles) {
        const filePath = path.join(options.projectPath, file);
        if (await fileExists(filePath)) {
          filesToRemove.push(filePath);
        }
      }

      result.success = true;
      result.message = "TypeScript configuration will be removed";
      result.hints = [
        `Files to be removed: ${filesToRemove
          .map((f) => path.basename(f))
          .join(", ")}`,
      ];

      return result;
    } catch (error) {
      if (error instanceof BaseError) {
        result.errors?.push(error);
      } else {
        result.errors?.push(
          new SimpleLogicError(
            LogicErrorCodes.MODULE_UNINSTALL_FAILED,
            `Failed to uninstall TypeScript config: ${error}`,
            false
          )
        );
      }
      return result;
    }
  }
}
