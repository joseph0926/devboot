import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import type { Ora } from "ora";
import { SimpleLogicError } from "../errors/logic.error.js";
import { LogicErrorCodes } from "../types/error.type.js";
import { BaseError } from "../errors/base.error.js";
import {
  PackageInstallError,
  PackageManagerExecutionError,
  PackageManagerNotFoundError,
} from "../errors/logic/package.error.js";
import { isNodeError, isNetworkError, ExecError } from "../types/error.type.js";
import { ErrorLogger } from "../utils/error-logger.js";

const execAsync = promisify(exec);

export interface Dependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PackageManagerOptions {
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  projectPath: string;
  verbose?: boolean;
}

export interface PackageInstallResult {
  success: boolean;
  installed: string[];
  error?: BaseError;
}

export class PackageManagerService {
  async install(
    deps: Dependencies,
    options: PackageManagerOptions,
  ): Promise<PackageInstallResult> {
    const packages = this.formatPackages(deps);

    if (packages.prod.length === 0 && packages.dev.length === 0) {
      return { success: true, installed: [] };
    }

    const spinner = logger.spinner("Installing packages...");

    try {
      const installed: string[] = [];

      if (packages.prod.length > 0) {
        await this.runInstallCommand(packages.prod, false, options, spinner);
        installed.push(...packages.prod);
      }

      if (packages.dev.length > 0) {
        await this.runInstallCommand(packages.dev, true, options, spinner);
        installed.push(...packages.dev);
      }

      spinner.succeed("Packages installed successfully");
      return { success: true, installed };
    } catch (error) {
      spinner.fail("Failed to install packages");

      if (error instanceof BaseError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new PackageInstallError(
        `Failed to install packages: ${errorMessage}`,
        {
          packages: [...packages.prod, ...packages.dev],
          packageManager: options.packageManager,
          originalError: errorMessage,
        },
        error,
      );
    }
  }

  private formatPackages(deps: Dependencies): {
    prod: string[];
    dev: string[];
  } {
    const prod = Object.entries(deps.dependencies || {}).map(
      ([name, version]) => `${name}@${version}`,
    );
    const dev = Object.entries(deps.devDependencies || {}).map(
      ([name, version]) => `${name}@${version}`,
    );

    return { prod, dev };
  }

  private async runInstallCommand(
    packages: string[],
    isDev: boolean,
    options: PackageManagerOptions,
    spinner: Ora,
  ): Promise<void> {
    const command = this.buildInstallCommand(
      packages,
      isDev,
      options.packageManager,
    );

    spinner.text = `Installing ${isDev ? "dev " : ""}dependencies...`;

    if (options.verbose) {
      logger.debug(`Running: ${command}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.projectPath,
      });

      if (options.verbose && stdout) {
        logger.debug(stdout);
      }

      if (stderr && !stderr.includes("warning")) {
        throw new PackageManagerExecutionError(
          `Package manager reported errors: ${stderr}`,
          {
            command,
            stderr,
            packageManager: options.packageManager,
            packages,
          },
        );
      }
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      if (isNodeError(error)) {
        if (error.code === "ENOENT") {
          throw new PackageManagerNotFoundError(
            `${options.packageManager} is not installed`,
            {
              packageManager: options.packageManager,
              errorCode: error.code,
            },
          );
        }

        if (error.code === "EACCES" || error.code === "EPERM") {
          throw new SimpleLogicError(
            LogicErrorCodes.PERMISSION_DENIED,
            "Permission denied while installing packages",
            false,
            {
              command,
              errorCode: error.code,
              packages,
            },
            "Try running with sudo or check npm/yarn permissions",
          );
        }

        if (isNetworkError(error)) {
          throw new SimpleLogicError(
            LogicErrorCodes.NETWORK_ERROR,
            "Network error while installing packages",
            true,
            {
              command,
              errorCode: error.code,
              packages,
            },
            "Check your internet connection and try again",
          );
        }
      }

      const execError = error as ExecError;
      if (execError.stderr) {
        if (execError.stderr.includes("E404")) {
          throw new PackageInstallError("One or more packages not found", {
            packages,
            packageManager: options.packageManager,
            stderr: execError.stderr,
          });
        }
      }

      throw error;
    }
  }

  private buildInstallCommand(
    packages: string[],
    isDev: boolean,
    packageManager: "npm" | "pnpm" | "yarn" | "bun",
  ): string {
    const packageList = packages.join(" ");

    switch (packageManager) {
      case "npm":
        return `npm install ${isDev ? "--save-dev" : "--save"} ${packageList}`;
      case "pnpm":
        return `pnpm add ${isDev ? "-D" : ""} ${packageList}`;
      case "yarn":
        return `yarn add ${isDev ? "-D" : ""} ${packageList}`;
      case "bun":
        return `bun add ${isDev ? "-d" : ""} ${packageList}`;
      default:
        throw new SimpleLogicError(
          LogicErrorCodes.INVALID_PACKAGE_MANAGER,
          `Unsupported package manager: ${packageManager}`,
          false,
          { packageManager },
          "Supported package managers: npm, pnpm, yarn, bun",
        );
    }
  }

  async uninstall(
    packages: string[],
    options: PackageManagerOptions,
  ): Promise<{ success: boolean; error?: Error }> {
    if (packages.length === 0) {
      return { success: true };
    }

    const command = this.buildUninstallCommand(
      packages,
      options.packageManager,
    );
    const spinner = logger.spinner("Uninstalling packages...");

    try {
      if (options.verbose) {
        logger.debug(`Running: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: options.projectPath,
      });

      if (options.verbose && stdout) {
        logger.debug(stdout);
      }

      if (stderr && !stderr.includes("warning")) {
        ErrorLogger.logWarning(`Uninstall warnings: ${stderr}`);
      }

      spinner.succeed("Packages uninstalled successfully");
      return { success: true };
    } catch (error) {
      spinner.fail("Failed to uninstall packages");

      if (isNodeError(error)) {
        if (error.code === "ENOENT") {
          throw new PackageManagerNotFoundError(
            `${options.packageManager} is not installed`,
            {
              packageManager: options.packageManager,
              errorCode: error.code,
            },
          );
        }

        if (error.code === "EACCES" || error.code === "EPERM") {
          throw new SimpleLogicError(
            LogicErrorCodes.PERMISSION_DENIED,
            "Permission denied while uninstalling packages",
            false,
            {
              command,
              errorCode: error.code,
              packages,
            },
            "Try running with sudo or check permissions",
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new SimpleLogicError(
        LogicErrorCodes.PKG_UNINSTALL_FAILED,
        `Failed to uninstall packages: ${errorMessage}`,
        true,
        {
          command,
          packages,
          errorMessage,
          packageManager: options.packageManager,
        },
        "Check if packages are installed and try again",
      );
    }
  }

  private buildUninstallCommand(
    packages: string[],
    packageManager: "npm" | "pnpm" | "yarn" | "bun",
  ): string {
    const packageList = packages.join(" ");

    switch (packageManager) {
      case "npm":
        return `npm uninstall ${packageList}`;
      case "pnpm":
        return `pnpm remove ${packageList}`;
      case "yarn":
        return `yarn remove ${packageList}`;
      case "bun":
        return `bun remove ${packageList}`;
      default:
        throw new SimpleLogicError(
          LogicErrorCodes.INVALID_PACKAGE_MANAGER,
          `Unsupported package manager: ${packageManager}`,
          false,
          { packageManager },
          "Supported package managers: npm, pnpm, yarn, bun",
        );
    }
  }
}
