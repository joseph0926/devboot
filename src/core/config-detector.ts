import path from "path";
import { fileExists } from "../utils/file";
import { ModuleRegistry } from "../modules";
import { LogicError, SimpleLogicError } from "../errors/logic.error";
import { LogicErrorCodes } from "../types/error.type";
import { logger } from "../utils/logger";
import {
  ConfigNotFoundError,
  ConfigReadError,
  ProjectNotValidError,
} from "../errors/logic/config.error";
import {
  ConfigCategories,
  ConfigPattern,
  DetectedConfig,
} from "../types/config.type";

export class ConfigDetector {
  private static readonly CONFIG_PATTERNS: ConfigPattern[] = [
    {
      name: "eslint",
      files: [
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.json",
        ".eslintrc.yml",
        ".eslintrc.yaml",
        "eslint.config.js",
        "eslint.config.mjs",
        "eslint.config.ts",
      ],
    },
    {
      name: "prettier",
      files: [
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.yml",
        ".prettierrc.yaml",
        ".prettierrc.js",
        ".prettierrc.cjs",
        ".prettierrc.mjs",
        "prettier.config.js",
        "prettier.config.cjs",
        "prettier.config.mjs",
        "prettier.config.ts",
      ],
    },
    {
      name: "typescript",
      files: ["tsconfig.json", "tsconfig.node.json"],
    },
    {
      name: "husky",
      directories: [".husky"],
    },
    {
      name: "editorconfig",
      files: [".editorconfig"],
    },
    {
      name: "vitest",
      files: ["vitest.config.ts", "vitest.config.js", "vitest.config.mjs"],
    },
    {
      name: "jest",
      files: [
        "jest.config.js",
        "jest.config.ts",
        "jest.config.mjs",
        "jest.config.json",
      ],
    },
  ];

  static async detectInstalledConfigs(
    projectPath: string,
  ): Promise<DetectedConfig[]> {
    try {
      await this.validateProjectPath(projectPath);

      const detectedConfigs = new Map<string, DetectedConfig>();

      try {
        const registryConfigs =
          await this.detectFromModuleRegistry(projectPath);
        registryConfigs.forEach((config) => {
          detectedConfigs.set(config.name, config);
        });
      } catch (error) {
        logger.warn(`Module registry detection failed: ${error}`);
      }

      try {
        const patternConfigs = await this.detectFromPatterns(projectPath);
        patternConfigs.forEach((config) => {
          if (!detectedConfigs.has(config.name)) {
            detectedConfigs.set(config.name, config);
          }
        });
      } catch (error) {
        logger.warn(`Pattern detection failed: ${error}`);
      }

      return Array.from(detectedConfigs.values());
    } catch (error) {
      if (error instanceof LogicError) {
        throw error;
      }

      throw new ConfigReadError(
        `Failed to detect installed configs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          filePath: projectPath,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  static async isConfigInstalled(
    projectPath: string,
    configName: string,
  ): Promise<boolean> {
    try {
      const module = ModuleRegistry.get(configName);
      if (module && (await module.isInstalled(projectPath))) {
        return true;
      }

      const pattern = this.CONFIG_PATTERNS.find((p) => p.name === configName);
      if (!pattern) {
        const availableConfigs = this.CONFIG_PATTERNS.map((p) => p.name);
        throw new ConfigNotFoundError(
          `Configuration pattern for '${configName}' not found`,
          { configName, availableConfigs },
        );
      }

      const { found } = await this.checkPattern(projectPath, pattern);
      return found;
    } catch (error) {
      if (error instanceof LogicError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_READ_ERROR,
        `Failed to check config '${configName}': ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        true,
        { configName, filePath: projectPath },
      );
    }
  }

  static async findConfigFile(
    projectPath: string,
    configName: string,
  ): Promise<string | null> {
    try {
      const pattern = this.CONFIG_PATTERNS.find((p) => p.name === configName);
      if (!pattern || !pattern.files) {
        return null;
      }

      for (const file of pattern.files) {
        const filePath = path.join(projectPath, file);
        if (await fileExists(filePath)) {
          return filePath;
        }
      }

      return null;
    } catch (error) {
      throw new ConfigReadError(
        `Failed to find config file for '${configName}'`,
        {
          configName,
          filePath: projectPath,
          originalError: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  private static async validateProjectPath(projectPath: string): Promise<void> {
    try {
      if (!projectPath || !(await fileExists(projectPath))) {
        throw new ProjectNotValidError(`Invalid project path: ${projectPath}`, {
          filePath: projectPath,
        });
      }

      const packageJsonPath = path.join(projectPath, "package.json");
      if (!(await fileExists(packageJsonPath))) {
        throw new ProjectNotValidError(
          "No package.json found in project directory",
          { filePath: packageJsonPath },
        );
      }
    } catch (error) {
      if (error instanceof LogicError) {
        throw error;
      }

      throw new ProjectNotValidError(
        `Failed to validate project path: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { filePath: projectPath },
      );
    }
  }

  private static async detectFromModuleRegistry(
    projectPath: string,
  ): Promise<DetectedConfig[]> {
    const modules = ModuleRegistry.getAll();
    const detected: DetectedConfig[] = [];

    for (const module of modules) {
      try {
        if (await module.isInstalled(projectPath)) {
          detected.push({
            name: module.name,
            detectedFiles: [],
            version: module.version,
          });
        }
      } catch (moduleError) {
        logger.debug(`Failed to check module '${module.name}': ${moduleError}`);
      }
    }

    return detected;
  }

  private static async detectFromPatterns(
    projectPath: string,
  ): Promise<DetectedConfig[]> {
    const detected: DetectedConfig[] = [];

    for (const pattern of this.CONFIG_PATTERNS) {
      try {
        const checkResult = await this.checkPattern(projectPath, pattern);
        if (checkResult.found) {
          detected.push({
            name: pattern.name,
            detectedFiles: checkResult.detectedFiles,
          });
        }
      } catch (error) {
        logger.debug(`Failed to check pattern '${pattern.name}': ${error}`);
      }
    }

    return detected;
  }

  private static async checkPattern(
    projectPath: string,
    pattern: ConfigPattern,
  ): Promise<{ found: boolean; detectedFiles: string[] }> {
    const detectedFiles: string[] = [];

    if (pattern.files) {
      for (const file of pattern.files) {
        try {
          const filePath = path.join(projectPath, file);
          if (await fileExists(filePath)) {
            detectedFiles.push(file);
          }
        } catch (error) {
          logger.debug(`Failed to check file '${file}': ${error}`);
        }
      }
    }

    if (pattern.directories) {
      for (const dir of pattern.directories) {
        try {
          const dirPath = path.join(projectPath, dir);
          if (await fileExists(dirPath)) {
            detectedFiles.push(dir);
          }
        } catch (error) {
          logger.debug(`Failed to check directory '${dir}': ${error}`);
        }
      }
    }

    return {
      found: detectedFiles.length > 0,
      detectedFiles,
    };
  }

  static categorizeConfigs(configs: DetectedConfig[]): ConfigCategories {
    const names = configs.map((c) => c.name);

    return {
      linting: names.filter((c) => ["eslint", "prettier"].includes(c)),
      testing: names.filter((c) => ["vitest", "jest", "cypress"].includes(c)),
      building: names.filter((c) =>
        ["typescript", "vite", "webpack"].includes(c),
      ),
      git: names.filter((c) => ["husky", "commitlint"].includes(c)),
      editor: names.filter((c) => ["editorconfig", "vscode"].includes(c)),
      other: names.filter(
        (c) =>
          ![
            "eslint",
            "prettier",
            "vitest",
            "jest",
            "cypress",
            "typescript",
            "vite",
            "webpack",
            "husky",
            "commitlint",
            "editorconfig",
            "vscode",
          ].includes(c),
      ),
    };
  }
}
