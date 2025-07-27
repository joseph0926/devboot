import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import type { Ora } from "ora";

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
  error?: Error;
}

export class PackageManagerService {
  async install(
    deps: Dependencies,
    options: PackageManagerOptions
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
      return {
        success: false,
        installed: [],
        error: error as Error,
      };
    }
  }

  private formatPackages(deps: Dependencies): {
    prod: string[];
    dev: string[];
  } {
    const prod = Object.entries(deps.dependencies || {}).map(
      ([name, version]) => `${name}@${version}`
    );
    const dev = Object.entries(deps.devDependencies || {}).map(
      ([name, version]) => `${name}@${version}`
    );

    return { prod, dev };
  }

  private async runInstallCommand(
    packages: string[],
    isDev: boolean,
    options: PackageManagerOptions,
    spinner: Ora
  ): Promise<void> {
    const command = this.buildInstallCommand(
      packages,
      isDev,
      options.packageManager
    );

    spinner.text = `Installing ${isDev ? "dev " : ""}dependencies...`;

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
      throw new Error(stderr);
    }
  }

  private buildInstallCommand(
    packages: string[],
    isDev: boolean,
    packageManager: "npm" | "pnpm" | "yarn" | "bun"
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
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }

  async uninstall(
    packages: string[],
    options: PackageManagerOptions
  ): Promise<{ success: boolean; error?: Error }> {
    if (packages.length === 0) {
      return { success: true };
    }

    const command = this.buildUninstallCommand(
      packages,
      options.packageManager
    );
    const spinner = logger.spinner("Uninstalling packages...");

    try {
      if (options.verbose) {
        logger.debug(`Running: ${command}`);
      }

      await execAsync(command, { cwd: options.projectPath });

      spinner.succeed("Packages uninstalled successfully");
      return { success: true };
    } catch (error) {
      spinner.fail("Failed to uninstall packages");
      return { success: false, error: error as Error };
    }
  }

  private buildUninstallCommand(
    packages: string[],
    packageManager: "npm" | "pnpm" | "yarn" | "bun"
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
        throw new Error(`Unsupported package manager: ${packageManager}`);
    }
  }
}
