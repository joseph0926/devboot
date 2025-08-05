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
import { ESLintConfigBuilder, type ESLintBuildResult } from "./builder.js";
import { logger } from "../../utils/logger.js";

export class ESLintModule extends BaseModule {
  private generatedResult?: ESLintBuildResult;

  constructor() {
    super({
      name: "eslint",
      displayName: "ESLint",
      description: "JavaScript and TypeScript linter for code quality",
      detectFiles: [
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.json",
        ".eslintrc.yml",
        ".eslintrc.yaml",
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.ts",
      ],
      conflicts: [],
      version: "1.0.0",
    });
  }

  async isInstalled(projectPath: string): Promise<boolean> {
    try {
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
          return !!packageJson.eslintConfig;
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
          "ESLint configuration already exists. Use --force to overwrite."
        );
        return result;
      }

      if (isInstalled && options.force) {
        result.warnings.push(
          "Existing ESLint configuration will be overwritten"
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

  async getDependencies(_options?: InstallOptions): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }> {
    if (this.generatedResult) {
      return {
        devDependencies: this.generatedResult.dependencies,
      };
    }

    return {
      devDependencies: {
        eslint: "^8.57.0",
        "@typescript-eslint/eslint-plugin": "^6.21.0",
        "@typescript-eslint/parser": "^6.21.0",
        "eslint-config-prettier": "^9.1.0",
      },
    };
  }

  async getFilesToCreate(
    options: InstallOptions
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      let result: ESLintBuildResult;

      if (!options.dryRun && !this.generatedResult) {
        const builder = new ESLintConfigBuilder();
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
              "ESLint setup cancelled by user",
              false
            );
          }
          throw error;
        }
      } else if (this.generatedResult) {
        result = this.generatedResult;
      } else {
        result = this.generateDefaultConfig(options);

        if (options.verbose) {
          logger.info("Using default ESLint configuration");
        }
      }

      files.set(result.configFileName, result.config);

      if (result.additionalFiles) {
        Object.entries(result.additionalFiles).forEach(
          ([filename, content]) => {
            files.set(filename, content);
          }
        );
      }

      return files;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_GENERATION_FAILED,
        "Failed to generate ESLint configuration",
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

    modifiers.set("package.json", (content: string) => {
      try {
        const packageJson = JSON.parse(content);

        if (!packageJson.scripts) {
          packageJson.scripts = {};
        }

        if (!packageJson.scripts.lint) {
          packageJson.scripts.lint = "eslint . --ext .js,.jsx,.ts,.tsx";
        }
        if (!packageJson.scripts["lint:fix"]) {
          packageJson.scripts["lint:fix"] =
            "eslint . --ext .js,.jsx,.ts,.tsx --fix";
        }

        return JSON.stringify(packageJson, null, 2);
      } catch (error) {
        logger.debug(`Failed to modify package.json: ${error}`);
        return content;
      }
    });

    return modifiers;
  }

  async uninstall(options: InstallOptions): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      errors: [],
      hints: [],
    };

    try {
      const configFiles = [
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.json",
        ".eslintrc.yml",
        ".eslintrc.yaml",
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.ts",
        ".eslintignore",
      ];

      const filesToRemove = [];

      for (const file of configFiles) {
        const filePath = path.join(options.projectPath, file);
        if (await fileExists(filePath)) {
          filesToRemove.push(filePath);
        }
      }

      if (filesToRemove.length === 0) {
        throw new FileNotFoundError("No ESLint configuration files found", {
          path: options.projectPath,
          operation: "delete",
        });
      }

      try {
        for (const filePath of filesToRemove) {
          await unlink(filePath);
        }

        result.success = true;
        result.message = "ESLint configuration removed successfully";

        if (options.verbose) {
          logger.success("ESLint configuration removed");
        }
      } catch (error: any) {
        if (error.code === "EACCES") {
          throw new SimpleLogicError(
            LogicErrorCodes.FILE_PERMISSION_ERROR,
            "Permission denied while removing ESLint configuration",
            false,
            {
              errorCode: error.code,
            },
            "Try running with elevated permissions (sudo)"
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
            `Failed to uninstall ESLint: ${errorMessage}`,
            false,
            {
              module: this.name,
              originalError: errorMessage,
            }
          )
        );
      }
    }

    return result;
  }

  private generateDefaultConfig(options: InstallOptions): ESLintBuildResult {
    const configType = "legacy" as const;
    const configFileName = ".eslintrc.json";
    let config: any;
    let dependencies: Record<string, string>;

    if (options.hasTypeScript) {
      if (
        options.projectType === "react" ||
        options.projectType === "next" ||
        options.projectType === "vite"
      ) {
        config = {
          env: {
            browser: true,
            es2021: true,
            node: true,
          },
          extends: [
            "eslint:recommended",
            "@typescript-eslint/recommended",
            "plugin:react/recommended",
            "plugin:react-hooks/recommended",
          ],
          parser: "@typescript-eslint/parser",
          parserOptions: {
            ecmaFeatures: { jsx: true },
            ecmaVersion: "latest",
            sourceType: "module",
          },
          plugins: ["react", "react-hooks", "@typescript-eslint"],
          rules: {
            "react/react-in-jsx-scope": "off",
            "react/prop-types": "off",
            "@typescript-eslint/no-unused-vars": [
              "error",
              { argsIgnorePattern: "^_" },
            ],
          },
          settings: {
            react: { version: "detect" },
          },
        };

        dependencies = {
          eslint: "^8.57.0",
          "@typescript-eslint/eslint-plugin": "^6.21.0",
          "@typescript-eslint/parser": "^6.21.0",
          "eslint-plugin-react": "^7.33.2",
          "eslint-plugin-react-hooks": "^4.6.0",
        };
      } else {
        config = {
          env: {
            node: true,
            es2021: true,
          },
          extends: ["eslint:recommended", "@typescript-eslint/recommended"],
          parser: "@typescript-eslint/parser",
          parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
          },
          plugins: ["@typescript-eslint"],
          rules: {
            "@typescript-eslint/no-unused-vars": [
              "error",
              { argsIgnorePattern: "^_" },
            ],
            "no-console": "warn",
          },
        };

        dependencies = {
          eslint: "^8.57.0",
          "@typescript-eslint/eslint-plugin": "^6.21.0",
          "@typescript-eslint/parser": "^6.21.0",
        };
      }
    } else {
      config = {
        env: {
          browser: true,
          node: true,
          es2021: true,
        },
        extends: ["eslint:recommended"],
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
        rules: {
          "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
          "no-console": "warn",
          "prefer-const": "error",
          "no-var": "error",
        },
      };

      dependencies = {
        eslint: "^8.57.0",
      };
    }

    const ignorePatterns = [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
    ];

    if (options.projectType === "next") {
      ignorePatterns.push(".next/", "next-env.d.ts");
    }

    return {
      config: JSON.stringify(config, null, 2),
      dependencies,
      additionalFiles: {
        ".eslintignore": ignorePatterns.join("\n") + "\n",
      },
      presetKey: null,
      configType,
      configFileName,
    };
  }
}
