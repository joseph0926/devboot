import { Command } from "commander";
import chalk from "chalk";
import { log } from "@clack/prompts";
import { ModuleRegistry } from "../../modules";
import { readPackageJson } from "../../utils/file";
import { logger } from "../../utils/logger";
import { CLIErrorHandler } from "../../errors/cli/cli-error-handler";
import { ExitCodes } from "../../types/exit-codes";
import { ErrorLogger } from "../../utils/error-logger";

export class ListCommand {
  static register(program: Command): void {
    program
      .command("list")
      .alias("ls")
      .description("List available modules")
      .option("-i, --installed", "Show only installed modules")
      .action(async (options) => {
        try {
          await ListCommand.execute(options);
        } catch (error) {
          CLIErrorHandler.handle(error, {
            verbose: false,
            showHelp: false,
          });
        }
      });
  }

  private static async execute(options: {
    installed?: boolean;
  }): Promise<void> {
    const projectPath = process.cwd();
    let installedModules: string[] = [];
    let isInProject = false;

    try {
      await readPackageJson(projectPath);
      isInProject = true;
      installedModules = await this.getInstalledModules(projectPath);
    } catch (error) {
      if (options.installed) {
        ErrorLogger.logWarning(
          "Not in a Node.js project - cannot check installed modules"
        );
        process.exit(ExitCodes.SUCCESS);
      }
    }

    log.message(chalk.bold("\n📦 Available DevBoot Modules:\n"));

    const modules = ModuleRegistry.getAll();
    let displayedCount = 0;

    for (const module of modules) {
      const isInstalled = installedModules.includes(module.name);

      if (options.installed && !isInstalled) continue;

      const status = isInProject
        ? isInstalled
          ? chalk.green("✓ installed")
          : chalk.gray("not installed")
        : "";

      log.message(
        `  ${chalk.cyan(module.name.padEnd(20))} ${
          module.description
        } ${status}`
      );
      displayedCount++;
    }

    if (displayedCount === 0 && options.installed) {
      log.message(chalk.gray("  No modules installed yet"));
    }

    log.message("");

    if (!options.installed && isInProject) {
      log.message(chalk.gray("Use 'devboot add <module>' to add a module"));
      log.message(
        chalk.gray("Use 'devboot list -i' to see only installed modules")
      );
    } else if (!isInProject) {
      log.message(chalk.gray("Run 'devboot init' in a project to get started"));
    }

    log.message("");
  }

  private static async getInstalledModules(
    projectPath: string
  ): Promise<string[]> {
    const installed: string[] = [];
    const modules = ModuleRegistry.getAll();

    for (const module of modules) {
      try {
        if (await module.isInstalled(projectPath)) {
          installed.push(module.name);
        }
      } catch (error) {
        logger.debug(
          `Failed to check if ${module.name} is installed: ${error}`
        );
      }
    }

    return installed;
  }
}
