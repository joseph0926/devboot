import type { ProjectContext } from "../types/project.type.js";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import path from "path";
import { logger } from "../utils/logger.js";
import { BaseError } from "../errors/base.error.js";
import { SimpleLogicError } from "../errors/logic.error.js";
import { FSError, isNodeError, LogicErrorCodes } from "../types/error.type.js";
import {
  FilePermissionError,
  FileOperationError,
  FileNotFoundError,
} from "../errors/logic/file.error.js";
import { ErrorLogger } from "../utils/error-logger.js";

export interface ModuleConfig {
  name: string;
  displayName: string;
  description: string;
  detectFiles: string[];
  conflicts?: string[];
  version?: string;
}

export interface InstallOptions extends ProjectContext {
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface InstallResult {
  success: boolean;
  message?: string;
  installedFiles?: string[];
  installedPackages?: string[];
  modifiedFiles?: string[];
  errors?: BaseError[];
  hints?: string[];
  rollbackActions?: (() => Promise<void>)[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflictingModules?: string[];
}

export type FileModifier = (content: string) => string | Promise<string>;

export abstract class BaseModule {
  constructor(protected config: ModuleConfig) {}

  get name(): string {
    return this.config.name;
  }

  get displayName(): string {
    return this.config.displayName;
  }

  get description(): string {
    return this.config.description;
  }

  get version(): string | undefined {
    return this.config.version;
  }

  abstract isInstalled(projectPath: string): Promise<boolean>;

  abstract validate(options: InstallOptions): Promise<ValidationResult>;

  abstract getDependencies(options: InstallOptions): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>;

  abstract getFilesToCreate(
    options: InstallOptions
  ): Promise<Map<string, string>>;

  abstract getFilesToModify(
    options: InstallOptions
  ): Promise<Map<string, FileModifier>>;

  async install(options: InstallOptions): Promise<InstallResult> {
    const result: InstallResult = {
      success: false,
      installedFiles: [],
      installedPackages: [],
      modifiedFiles: [],
      errors: [],
      hints: [],
      rollbackActions: [],
    };

    try {
      const validation = await this.validate(options);

      if (!validation.valid) {
        result.errors = validation.errors.map(
          (err) =>
            new SimpleLogicError(
              LogicErrorCodes.MODULE_CONFIG_INVALID,
              err,
              false,
              {
                module: this.name,
                validationErrors: validation.errors,
                conflictingModules: validation.conflictingModules,
              },
              validation.conflictingModules?.length
                ? "Use --force to override existing configurations"
                : undefined
            )
        );

        if (validation.conflictingModules?.length) {
          result.hints?.push("Use --force to override existing configurations");
        }

        return result;
      }

      if (validation.warnings.length > 0 && options.verbose) {
        validation.warnings.forEach((warn) => logger.warn(warn));
      }

      if (options.dryRun) {
        await this.previewChanges(options);
        result.success = true;
        result.message = "Dry run completed successfully";
        return result;
      }

      const filesToCreate = await this.getFilesToCreate(options);
      for (const [filePath, content] of filesToCreate) {
        await this.createFile(
          path.join(options.projectPath, filePath),
          content,
          result,
          options
        );
      }

      const filesToModify = await this.getFilesToModify(options);
      for (const [filePath, modifier] of filesToModify) {
        await this.modifyFile(
          path.join(options.projectPath, filePath),
          modifier,
          result,
          options
        );
      }

      const deps = await this.getDependencies(options);
      if (deps.dependencies || deps.devDependencies) {
        if (options.verbose) {
          logger.info("Dependencies to be installed by package manager");
        }
      }

      result.success = true;
      result.message = `${this.displayName} configured successfully`;
      return result;
    } catch (error) {
      if (result.rollbackActions?.length) {
        if (options.verbose) {
          logger.info("Rolling back changes...");
        }

        try {
          await this.rollback(result.rollbackActions);
        } catch (rollbackError) {
          const rollbackErrorObj = new SimpleLogicError(
            LogicErrorCodes.ROLLBACK_FAILED,
            "Failed to rollback changes",
            false,
            {
              module: this.name,
              originalError:
                error instanceof Error ? error.message : String(error),
              rollbackError:
                rollbackError instanceof Error
                  ? rollbackError.message
                  : String(rollbackError),
            }
          );
          result.errors?.push(rollbackErrorObj);
        }
      }

      if (error instanceof BaseError) {
        result.errors?.push(error);
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors?.push(
          new SimpleLogicError(
            LogicErrorCodes.MODULE_INSTALL_FAILED,
            `Module installation failed: ${errorMessage}`,
            false,
            {
              module: this.name,
              originalError: errorMessage,
            }
          )
        );
      }

      result.success = false;
      return result;
    }
  }

  private async previewChanges(options: InstallOptions): Promise<void> {
    logger.info("📋 Preview of changes:\n");

    const filesToCreate = await this.getFilesToCreate(options);
    if (filesToCreate.size > 0) {
      logger.info("Files to create:");
      for (const [filePath] of filesToCreate) {
        logger.info(`  ✨ ${filePath}`);
      }
      logger.info("");
    }

    const filesToModify = await this.getFilesToModify(options);
    if (filesToModify.size > 0) {
      logger.info("Files to modify:");
      for (const [filePath] of filesToModify) {
        logger.info(`  ✏️  ${filePath}`);
      }
      logger.info("");
    }

    const deps = await this.getDependencies(options);
    if (deps.dependencies || deps.devDependencies) {
      logger.info("Packages to install:");
      Object.entries(deps.dependencies || {}).forEach(([pkg, version]) => {
        logger.info(`  📦 ${pkg}@${version}`);
      });
      Object.entries(deps.devDependencies || {}).forEach(([pkg, version]) => {
        logger.info(`  📦 ${pkg}@${version} (dev)`);
      });
    }
  }

  abstract uninstall?(options: InstallOptions): Promise<InstallResult>;

  private async createFile(
    filePath: string,
    content: string,
    result: InstallResult,
    options: InstallOptions
  ): Promise<void> {
    try {
      const dir = path.dirname(filePath);

      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        if (isNodeError(error)) {
          const fsError = error as FSError;
          if (fsError.code === "EACCES" || fsError.code === "EPERM") {
            throw new FilePermissionError(
              `Permission denied creating directory: ${dir}`,
              {
                path: dir,
                operation: "mkdir",
                errorCode: fsError.code,
              }
            );
          }
        }
        throw error;
      }

      try {
        await writeFile(filePath, content, "utf-8");
      } catch (error) {
        if (isNodeError(error)) {
          const fsError = error as FSError;
          if (fsError.code === "EACCES" || fsError.code === "EPERM") {
            throw new FilePermissionError(
              `Permission denied writing file: ${filePath}`,
              {
                path: filePath,
                operation: "write",
                errorCode: fsError.code,
              }
            );
          }
          if (fsError.code === "ENOSPC") {
            throw new SimpleLogicError(
              LogicErrorCodes.DISK_FULL,
              "Not enough disk space",
              false,
              { path: filePath }
            );
          }
        }
        throw error;
      }

      result.installedFiles?.push(path.relative(options.projectPath, filePath));

      if (options.verbose) {
        ErrorLogger.logInfo(
          `Created: ${path.relative(options.projectPath, filePath)}`
        );
      }

      result.rollbackActions?.push(async () => {
        try {
          await unlink(filePath);
        } catch (error) {
          logger.debug(`Rollback: File already removed: ${filePath}`);
        }
      });
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new FileOperationError(
        `Failed to create file: ${filePath}`,
        {
          path: filePath,
          operation: "create",
          originalError: error instanceof Error ? error.message : String(error),
        },
        error
      );
    }
  }

  private async modifyFile(
    filePath: string,
    modifier: FileModifier,
    result: InstallResult,
    options: InstallOptions
  ): Promise<void> {
    let originalContent: string;

    try {
      try {
        originalContent = await readFile(filePath, "utf-8");
      } catch (error) {
        if (isNodeError(error)) {
          const fsError = error as FSError;
          if (fsError.code === "ENOENT") {
            throw new FileNotFoundError(`File not found: ${filePath}`, {
              path: filePath,
              operation: "read",
            });
          }
          if (fsError.code === "EACCES" || fsError.code === "EPERM") {
            throw new FilePermissionError(
              `Permission denied reading file: ${filePath}`,
              {
                path: filePath,
                operation: "read",
                errorCode: fsError.code,
              }
            );
          }
        }
        throw error;
      }

      let modifiedContent: string;
      try {
        modifiedContent = await modifier(originalContent);
      } catch (error) {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_MODIFICATION_FAILED,
          `Failed to modify file content: ${filePath}`,
          false,
          {
            path: filePath,
            modifierError:
              error instanceof Error ? error.message : String(error),
          }
        );
      }

      try {
        await writeFile(filePath, modifiedContent, "utf-8");
      } catch (error) {
        if (isNodeError(error)) {
          const fsError = error as FSError;
          if (fsError.code === "EACCES" || fsError.code === "EPERM") {
            throw new FilePermissionError(
              `Permission denied writing file: ${filePath}`,
              {
                path: filePath,
                operation: "write",
                errorCode: fsError.code,
              }
            );
          }
        }
        throw error;
      }

      result.modifiedFiles?.push(path.relative(options.projectPath, filePath));

      if (options.verbose) {
        ErrorLogger.logInfo(
          `Modified: ${path.relative(options.projectPath, filePath)}`
        );
      }

      result.rollbackActions?.push(async () => {
        await writeFile(filePath, originalContent, "utf-8");
      });
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new FileOperationError(
        `Failed to modify file: ${filePath}`,
        {
          path: filePath,
          operation: "modify",
          originalError: error instanceof Error ? error.message : String(error),
        },
        error
      );
    }
  }

  private async rollback(actions: (() => Promise<void>)[]): Promise<void> {
    for (const action of actions.reverse()) {
      try {
        await action();
      } catch (error) {
        ErrorLogger.logError(error, { verbose: false });
      }
    }
  }

  protected checkNodeVersion(minVersion: string): boolean {
    try {
      const current = process.version.slice(1).split(".").map(Number);
      const required = minVersion.split(".").map(Number);

      for (let i = 0; i < Math.max(current.length, required.length); i++) {
        const currentPart = current[i] || 0;
        const requiredPart = required[i] || 0;

        if (isNaN(currentPart) || isNaN(requiredPart)) {
          logger.warn(`Invalid version number at position ${i}`);
          return false;
        }

        if (currentPart > requiredPart) return true;
        if (currentPart < requiredPart) return false;
      }

      return true;
    } catch (error) {
      logger.error(`Version check failed: ${error}`);
      return false;
    }
  }
}
