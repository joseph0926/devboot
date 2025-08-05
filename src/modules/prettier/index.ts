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
import { FileNotFoundError } from "../../errors/logic/file.error.js";
import { unlink } from "fs/promises";
import { BaseError } from "../../errors/base.error.js";
import { PrettierConfigBuilder, type PrettierBuildResult } from "./builder.js";
import { logger } from "../../utils/logger.js";

export class PrettierModule extends BaseModule {
  private generatedResult?: PrettierBuildResult;

  constructor() {
    super({
      name: "prettier",
      displayName: "Prettier",
      description: "Code formatter for consistent code style",
      detectFiles: [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        ".prettierrc.cjs",
        ".prettierrc.mjs",
        "prettier.config.js",
        "prettier.config.cjs",
        "prettier.config.mjs",
      ],
      conflicts: [],
      version: "1.0.0",
    });
  }

  async isInstalled(projectPath: string): Promise<boolean> {
    try {
      const configFiles = [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        ".prettierrc.cjs",
        ".prettierrc.mjs",
        "prettier.config.js",
        "prettier.config.cjs",
        "prettier.config.mjs",
        ".prettierrc.yaml",
        ".prettierrc.yml",
      ];

      for (const file of configFiles) {
        if (await fileExists(path.join(projectPath, file))) {
          return true;
        }
      }

      const packageJsonPath = path.join(projectPath, "package.json");
      if (await fileExists(packageJsonPath)) {
        try {
          const { readFile } = await import("fs/promises");
          const packageContent = await readFile(packageJsonPath, "utf-8");
          const packageJson = JSON.parse(packageContent);
          return !!packageJson.prettier;
        } catch {
          return false;
        }
      }

      return false;
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
        result.valid = false;
        result.errors.push(
          "Prettier configuration already exists. Use --force to overwrite.",
        );
        return result;
      }

      if (isInstalled && options.force) {
        result.warnings.push(
          "Existing Prettier configuration will be overwritten",
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

  async getDependencies(): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }> {
    return {
      devDependencies: {
        prettier: "^3.4.2",
      },
    };
  }

  async getFilesToCreate(
    options: InstallOptions,
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      let result: PrettierBuildResult;

      if (!options.dryRun && !this.generatedResult) {
        const builder = new PrettierConfigBuilder();
        try {
          // Use non-interactive mode for dry-run and when CI environment is detected
          const nonInteractive = options.dryRun || process.env.CI === 'true' || !process.stdin.isTTY;
          this.generatedResult = await builder.build(options, nonInteractive);
          result = this.generatedResult;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Configuration cancelled"
          ) {
            throw new SimpleLogicError(
              LogicErrorCodes.USER_CANCELLED,
              "Prettier setup cancelled by user",
              false,
            );
          }
          throw error;
        }
      } else if (this.generatedResult) {
        result = this.generatedResult;
      } else {
        result = this.generateDefaultConfig(options);

        if (options.verbose) {
          logger.info("Using default Prettier configuration");
        }
      }

      files.set(result.configFileName, result.config);

      const ignoreContent = this.generateIgnoreFile(options);
      files.set(".prettierignore", ignoreContent);

      return files;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_GENERATION_FAILED,
        "Failed to generate Prettier configuration",
        false,
        {
          module: this.name,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  async getFilesToModify(): Promise<Map<string, FileModifier>> {
    return new Map();
  }

  async uninstall(options: InstallOptions): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      errors: [],
      hints: [],
    };

    try {
      const configFiles = [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.js",
        ".prettierrc.cjs",
        ".prettierrc.mjs",
        "prettier.config.js",
        "prettier.config.cjs",
        "prettier.config.mjs",
        ".prettierrc.yaml",
        ".prettierrc.yml",
        ".prettierignore",
      ];

      const filesToRemove = [];

      for (const file of configFiles) {
        const filePath = path.join(options.projectPath, file);
        if (await fileExists(filePath)) {
          filesToRemove.push(filePath);
        }
      }

      if (filesToRemove.length === 0) {
        throw new FileNotFoundError("No Prettier configuration files found", {
          path: options.projectPath,
          operation: "delete",
        });
      }

      try {
        for (const filePath of filesToRemove) {
          await unlink(filePath);
        }

        result.success = true;
        result.message = "Prettier configuration removed successfully";

        if (options.verbose) {
          logger.success("Prettier configuration removed");
        }
      } catch (error: any) {
        if (error.code === "EACCES") {
          throw new SimpleLogicError(
            LogicErrorCodes.FILE_PERMISSION_ERROR,
            "Permission denied while removing Prettier configuration",
            false,
            {
              errorCode: error.code,
            },
            "Try running with elevated permissions (sudo)",
          );
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof BaseError) {
        result.errors?.push(error);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors?.push(
          new SimpleLogicError(
            LogicErrorCodes.MODULE_UNINSTALL_FAILED,
            `Failed to uninstall Prettier: ${errorMessage}`,
            false,
            {
              module: this.name,
              originalError: errorMessage,
            },
          ),
        );
      }
    }

    return result;
  }

  private generateDefaultConfig(options: InstallOptions): PrettierBuildResult {
    const config: Record<string, any> = {
      semi: true,
      singleQuote: true,
      trailingComma: "es5",
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      endOfLine: "lf",
    };

    if (
      options.projectType === "next" ||
      options.projectType === "react" ||
      options.projectType === "vite"
    ) {
      config.jsxSingleQuote = true;
    }

    if (options.hasTypeScript) {
      config.parser = "typescript";
    }

    // Default to JSON format for backward compatibility
    const configFileName = ".prettierrc.json";

    return {
      config: JSON.stringify(config, null, 2),
      configFileName,
      presetName: null,
    };
  }

  private generateIgnoreFile(options: InstallOptions): string {
    const ignorePatterns = [
      "# Dependencies",
      "node_modules/",
      "",
      "# Build outputs",
      "dist/",
      "build/",
      "out/",
      "",
      "# Environment files",
      ".env*",
      "",
      "# IDE files",
      ".vscode/",
      ".idea/",
      "",
      "# OS files",
      ".DS_Store",
      "Thumbs.db",
      "",
      "# Logs",
      "*.log",
      "logs/",
      "",
      "# Package manager files",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "",
    ];

    if (options.projectType === "next") {
      ignorePatterns.push("# Next.js", ".next/", "next-env.d.ts", "");
    }

    if (options.projectType === "vite") {
      ignorePatterns.push("# Vite", ".vite/", "");
    }

    ignorePatterns.push("# Coverage", "coverage/", "");

    return ignorePatterns.join("\n");
  }
}
