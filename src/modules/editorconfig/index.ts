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
import { EditorConfigBuilder } from "./builder.js";
import { logger } from "../../utils/logger.js";

export class EditorConfigModule extends BaseModule {
  private generatedContent?: string;

  constructor() {
    super({
      name: "editorconfig",
      displayName: "EditorConfig",
      description: "Consistent coding styles across different editors",
      detectFiles: [".editorconfig"],
      conflicts: [],
      version: "1.0.0",
    });
  }

  async isInstalled(projectPath: string): Promise<boolean> {
    try {
      return await fileExists(path.join(projectPath, ".editorconfig"));
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
          ".editorconfig already exists. Use --force to overwrite.",
        );
        return result;
      }

      if (isInstalled && options.force) {
        result.warnings.push("Existing .editorconfig will be overwritten");
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
    return {};
  }

  async getFilesToCreate(
    options: InstallOptions,
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      let content: string;

      if (!options.dryRun && !this.generatedContent) {
        const builder = new EditorConfigBuilder();
        try {
          this.generatedContent = await builder.build(options);
          content = this.generatedContent;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Configuration cancelled"
          ) {
            throw new SimpleLogicError(
              LogicErrorCodes.USER_CANCELLED,
              "EditorConfig setup cancelled by user",
              false,
            );
          }
          throw error;
        }
      } else if (this.generatedContent) {
        content = this.generatedContent;
      } else {
        content = this.generateDefaultConfig(options);

        if (options.verbose) {
          logger.info("Using default EditorConfig configuration");
        }
      }

      files.set(".editorconfig", content);
      return files;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_GENERATION_FAILED,
        "Failed to generate .editorconfig content",
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
      const configPath = path.join(options.projectPath, ".editorconfig");

      if (!(await fileExists(configPath))) {
        throw new FileNotFoundError(".editorconfig file not found", {
          path: configPath,
          operation: "delete",
        });
      }

      try {
        await unlink(configPath);
        result.success = true;
        result.message = ".editorconfig removed successfully";

        if (options.verbose) {
          logger.success("EditorConfig configuration removed");
        }
      } catch (error: any) {
        if (error.code === "EACCES") {
          throw new SimpleLogicError(
            LogicErrorCodes.FILE_PERMISSION_ERROR,
            "Permission denied while removing .editorconfig",
            false,
            {
              path: configPath,
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
            `Failed to uninstall EditorConfig: ${errorMessage}`,
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

  /**
   * 비대화형 모드나 dry-run을 위한 기본 설정 생성
   */
  private generateDefaultConfig(options: InstallOptions): string {
    const lines: string[] = [
      "# EditorConfig is awesome: https://EditorConfig.org",
      "",
      "root = true",
      "",
      "[*]",
      "charset = utf-8",
      "end_of_line = lf",
      "insert_final_newline = true",
      "trim_trailing_whitespace = true",
      "indent_style = space",
      "indent_size = 2",
      "",
    ];

    lines.push("[*.md]", "trim_trailing_whitespace = false", "");

    lines.push("[*.{json,yml,yaml}]", "indent_size = 2", "");

    if (["next", "vite", "react", "node"].includes(options.projectType)) {
      lines.push("[*.{js,jsx,mjs,cjs}]", "indent_size = 2", "");

      if (options.hasTypeScript) {
        lines.push("[*.{ts,tsx}]", "indent_size = 2", "");
      }
    }

    lines.push("[Makefile]", "indent_style = tab", "");

    const prettierConfig = options.packageJson.prettier;
    if (prettierConfig && typeof prettierConfig === "object") {
      if (
        "tabWidth" in prettierConfig &&
        typeof prettierConfig.tabWidth === "number"
      ) {
        const content = lines.join("\n");
        return content.replace(
          /indent_size = \d+/g,
          `indent_size = ${prettierConfig.tabWidth}`,
        );
      }

      if ("useTabs" in prettierConfig && prettierConfig.useTabs === true) {
        const content = lines.join("\n");
        return content.replace(/indent_style = space/g, "indent_style = tab");
      }
    }

    return lines.join("\n");
  }
}
