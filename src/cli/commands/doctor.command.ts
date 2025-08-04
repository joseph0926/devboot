import { Command } from "commander";
import { intro, outro, log } from "@clack/prompts";
import chalk from "chalk";
import { readPackageJson, fileExists } from "../../utils/file";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { ModuleRegistry } from "../../modules";
import { CLIErrorHandler } from "../../errors/cli/cli-error-handler";
import { ErrorLogger } from "../../utils/error-logger";

const execAsync = promisify(exec);

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
}

export class DoctorCommand {
  static register(program: Command): void {
    program
      .command("doctor")
      .description("Check your DevBoot setup")
      .action(async () => {
        try {
          await DoctorCommand.execute();
        } catch (error) {
          CLIErrorHandler.handle(error, {
            verbose: true,
            showHelp: false,
          });
        }
      });
  }

  private static async execute(): Promise<void> {
    intro(chalk.cyan("🏥 DevBoot Doctor"));

    const projectPath = process.cwd();
    const checks: HealthCheck[] = [];

    await this.checkPackageJson(projectPath, checks);

    this.checkNodeVersion(checks);

    await this.checkGitRepository(projectPath, checks);

    await this.checkPackageManager(checks);

    await this.checkInstalledModules(projectPath, checks);

    await this.checkCommonConfigs(projectPath, checks);

    this.displayResults(checks);

    outro("Check complete!");
  }

  private static async checkPackageJson(
    projectPath: string,
    checks: HealthCheck[],
  ): Promise<void> {
    try {
      const pkg = await readPackageJson(projectPath);
      checks.push({
        name: "package.json",
        status: "ok",
        message: `Found: ${pkg.name || "unnamed project"}`,
      });
    } catch {
      checks.push({
        name: "package.json",
        status: "error",
        message: "Not found - not a Node.js project",
      });
    }
  }

  private static checkNodeVersion(checks: HealthCheck[]): void {
    const nodeVersion = process.version || "";
    const versionParts = nodeVersion.slice(1).split(".");
    const majorVersion = parseInt(versionParts[0] || "0", 10);

    if (!nodeVersion || !versionParts[0] || isNaN(majorVersion)) {
      checks.push({
        name: "Node.js",
        status: "error",
        message: `Invalid version: ${nodeVersion || "unknown"}`,
      });
    } else if (majorVersion >= 22) {
      checks.push({
        name: "Node.js",
        status: "ok",
        message: nodeVersion,
      });
    } else if (majorVersion >= 18) {
      checks.push({
        name: "Node.js",
        status: "warn",
        message: `${nodeVersion} (22+ recommended for best performance)`,
      });
    } else {
      checks.push({
        name: "Node.js",
        status: "error",
        message: `${nodeVersion} (18+ required, 22+ recommended)`,
      });
    }
  }

  private static async checkGitRepository(
    projectPath: string,
    checks: HealthCheck[],
  ): Promise<void> {
    const gitExists = await fileExists(path.join(projectPath, ".git"));

    if (gitExists) {
      try {
        const { stdout } = await execAsync("git status --porcelain", {
          cwd: projectPath,
        });
        const hasChanges = stdout.trim().length > 0;

        checks.push({
          name: "Git repository",
          status: "ok",
          message: hasChanges
            ? "Initialized (uncommitted changes)"
            : "Initialized (clean)",
        });
      } catch {
        checks.push({
          name: "Git repository",
          status: "warn",
          message: "Initialized (status check failed)",
        });
      }
    } else {
      checks.push({
        name: "Git repository",
        status: "warn",
        message: "Not initialized",
      });
    }
  }

  private static async checkPackageManager(
    checks: HealthCheck[],
  ): Promise<void> {
    const managers = [
      { name: "pnpm", cmd: "pnpm --version" },
      { name: "yarn", cmd: "yarn --version" },
      { name: "npm", cmd: "npm --version" },
      { name: "bun", cmd: "bun --version" },
    ];

    const available: string[] = [];

    for (const { name, cmd } of managers) {
      try {
        await execAsync(cmd);
        available.push(name);
      } catch {}
    }

    if (available.length > 0) {
      checks.push({
        name: "Package managers",
        status: "ok",
        message: available.join(", "),
      });
    } else {
      checks.push({
        name: "Package managers",
        status: "error",
        message: "None found",
      });
    }
  }

  private static async checkInstalledModules(
    projectPath: string,
    checks: HealthCheck[],
  ): Promise<void> {
    try {
      await readPackageJson(projectPath);

      const modules = ModuleRegistry.getAll();
      const installed: string[] = [];

      for (const module of modules) {
        if (await module.isInstalled(projectPath)) {
          installed.push(module.name);
        }
      }

      if (installed.length > 0) {
        checks.push({
          name: "DevBoot modules",
          status: "ok",
          message: installed.join(", "),
        });
      } else {
        checks.push({
          name: "DevBoot modules",
          status: "warn",
          message: "None installed yet",
        });
      }
    } catch {}
  }

  private static async checkCommonConfigs(
    projectPath: string,
    checks: HealthCheck[],
  ): Promise<void> {
    const configs = [
      { file: "tsconfig.json", name: "TypeScript" },
      { file: ".eslintrc.js", name: "ESLint" },
      { file: ".prettierrc", name: "Prettier" },
      { file: ".editorconfig", name: "EditorConfig" },
      { file: ".husky", name: "Husky", isDirectory: true },
    ];

    const found: string[] = [];

    for (const { file, name } of configs) {
      if (await fileExists(path.join(projectPath, file))) {
        found.push(name);
      }
    }

    if (found.length > 0) {
      checks.push({
        name: "Dev tools",
        status: "ok",
        message: found.join(", "),
      });
    }
  }

  private static displayResults(checks: HealthCheck[]): void {
    log.message("");

    const hasErrors = checks.some((c) => c.status === "error");
    const hasWarnings = checks.some((c) => c.status === "warn");

    checks.forEach(({ name, status, message }) => {
      const icon =
        status === "ok"
          ? chalk.green("✓")
          : status === "warn"
            ? chalk.yellow("⚠")
            : chalk.red("✗");

      log.message(`  ${icon} ${name.padEnd(20)} ${message}`);
    });

    log.message("");

    if (hasErrors) {
      ErrorLogger.logError(
        new Error(
          "Some critical issues found. Please fix them before proceeding.",
        ),
        { verbose: false },
      );
    } else if (hasWarnings) {
      ErrorLogger.logWarning("Some warnings found, but you can proceed.");
    } else {
      ErrorLogger.logInfo("Everything looks good!");
    }
  }
}
