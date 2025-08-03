import { intro, outro, spinner, log, cancel } from "@clack/prompts";
import chalk from "chalk";
import { BaseError } from "../../../errors/base.error";
import { InstallResult } from "../../../modules/base.module";
import { ModuleRegistry } from "../../../modules";
import { ModuleInstaller } from "../../../core/installer";
import { SimpleCLIError } from "../../../errors/cli.error";
import { CLIErrorCodes, LogicErrorCodes } from "../../../types/error.type";
import { LogicError, SimpleLogicError } from "../../../errors/logic.error";

export interface AddFlowOptions {
  modules: string[];
  noInstall: boolean;
  verbose: boolean;
  dryRun: boolean;
}

export class AddFlow {
  constructor(private readonly moduleInstaller: ModuleInstaller) {}

  async execute(options: AddFlowOptions): Promise<void> {
    try {
      await this.validateProject();

      const validatedModules = await this.validateModules(options.modules);

      intro(
        chalk.cyan(
          `Adding ${validatedModules.length} module${
            validatedModules.length > 1 ? "s" : ""
          }`
        )
      );

      if (options.dryRun) {
        await this.handleDryRun(validatedModules, options);
        return;
      }

      const results = await this.installModules(validatedModules, options);

      this.showCompletionMessage(results);

      outro(chalk.green("✨ All modules added successfully!"));
    } catch (error) {
      await this.handleError(error);
    }
  }

  private async validateProject(): Promise<void> {
    const projectPath = process.cwd();

    try {
      await this.moduleInstaller.prepareContext(projectPath);
    } catch (error) {
      if (error instanceof BaseError) {
        if (error.code === LogicErrorCodes.PROJECT_NOT_FOUND) {
          throw new SimpleCLIError(
            CLIErrorCodes.NOT_IN_PROJECT,
            "Not a Node.js project",
            true,
            1,
            false,
            {
              currentPath: projectPath,
              suggestion: "Run this command in a directory with package.json",
            }
          );
        }
        throw error;
      }
      throw new SimpleCLIError(
        CLIErrorCodes.INVALID_ARGUMENT,
        "Failed to validate project",
        false,
        1,
        false,
        { originalError: error }
      );
    }
  }

  private async validateModules(moduleNames: string[]): Promise<string[]> {
    const availableModules = ModuleRegistry.list();
    const invalidModules = moduleNames.filter(
      (name) => !availableModules.includes(name)
    );

    if (invalidModules.length > 0) {
      log.error(
        `${chalk.red("Invalid modules:")} ${invalidModules.join(", ")}`
      );
      log.message("");
      log.message(chalk.yellow("Available modules:"));

      ModuleRegistry.getAll().forEach((module) => {
        log.message(
          `  ${chalk.cyan(module.name.padEnd(20))} ${module.description}`
        );
      });

      log.message("");
      log.message(
        `Example: ${chalk.cyan("devboot add eslint-prettier typescript")}`
      );

      throw new SimpleCLIError(
        CLIErrorCodes.INVALID_ARGUMENT,
        "Invalid module names provided",
        true,
        1,
        false,
        { invalidModules, availableModules }
      );
    }

    return [...new Set(moduleNames)];
  }

  private async handleDryRun(
    modules: string[],
    options: AddFlowOptions
  ): Promise<void> {
    log.info(chalk.blue("🔍 Dry run mode - no changes will be made"));
    log.message("");

    const context = await this.moduleInstaller.prepareContext(process.cwd());

    for (const moduleName of modules) {
      const module = ModuleRegistry.get(moduleName);
      if (!module) continue;

      log.message(chalk.bold(`\n📦 ${module.displayName}`));

      const result = await module.install({
        ...context,
        ...options,
      });

      if (!result.success && result.errors?.length) {
        result.errors.forEach((error) => {
          log.error(`  ${error.message}`);
        });
      }
    }

    outro(chalk.green("Dry run complete!"));
  }

  private async installModules(
    moduleNames: string[],
    options: AddFlowOptions
  ): Promise<Map<string, InstallResult>> {
    const results = new Map<string, InstallResult>();
    const context = await this.moduleInstaller.prepareContext(process.cwd());

    if (options.verbose) {
      log.message("");
      log.info(chalk.dim("Project details:"));
      log.message(chalk.dim(`  Type: ${context.projectType}`));
      log.message(
        chalk.dim(`  TypeScript: ${context.hasTypeScript ? "Yes" : "No"}`)
      );
      log.message(chalk.dim(`  Package Manager: ${context.packageManager}`));
      log.message("");
    }

    for (const moduleName of moduleNames) {
      const module = ModuleRegistry.get(moduleName);
      if (!module) continue;

      const s = spinner();
      s.start(`Installing ${module.displayName}`);

      try {
        const result = await this.moduleInstaller.installModule(
          moduleName,
          process.cwd(),
          {
            force: false,
            verbose: options.verbose,
            dryRun: false,
          }
        );

        results.set(moduleName, result);

        if (result.success) {
          s.stop(`${chalk.green("✓")} ${module.displayName} installed`);

          if (options.verbose && result.installedFiles?.length) {
            result.installedFiles.forEach((file) => {
              log.message(chalk.dim(`    Created: ${file}`));
            });
          }

          if (options.verbose && result.installedPackages?.length) {
            log.message(
              chalk.dim(
                `    Installed ${result.installedPackages.length} package${
                  result.installedPackages.length > 1 ? "s" : ""
                }`
              )
            );
          }

          if (result.hints?.length) {
            result.hints.forEach((hint) => {
              log.message(chalk.yellow(`    💡 ${hint}`));
            });
          }
        } else {
          s.stop(`${chalk.red("✗")} Failed to install ${module.displayName}`);

          if (result.errors?.length) {
            result.errors.forEach((error) => {
              log.error(`    ${error.message}`);
              if (error instanceof LogicError) {
                log.message(chalk.yellow(`    💡 ${error.solution}`));
              }
            });
          }
        }
      } catch (error) {
        s.stop(`${chalk.red("✗")} Failed to install ${module.displayName}`);

        const errorResult: InstallResult = {
          success: false,
          errors: [
            error instanceof BaseError
              ? error
              : new SimpleLogicError(
                  LogicErrorCodes.MODULE_INSTALL_FAILED,
                  error instanceof Error ? error.message : String(error),
                  false,
                  { module: moduleName }
                ),
          ],
        };

        results.set(moduleName, errorResult);

        if (error instanceof BaseError) {
          log.error(`    ${error.message}`);
          if (error instanceof LogicError) {
            log.message(chalk.yellow(`    💡 ${error.solution}`));
          }
        } else {
          log.error(
            `    ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return results;
  }

  private showCompletionMessage(results: Map<string, InstallResult>): void {
    const successCount = Array.from(results.values()).filter(
      (r) => r.success
    ).length;

    if (successCount === 0) return;

    log.message("");
    log.success(
      `Successfully installed ${successCount} module${
        successCount > 1 ? "s" : ""
      }`
    );

    const nextSteps: string[] = [];

    if (results.has("git-hooks") && results.get("git-hooks")?.success) {
      nextSteps.push("git add -A && git commit -m 'Add dev tools'");
    }

    if (
      results.has("eslint-prettier") &&
      results.get("eslint-prettier")?.success
    ) {
      nextSteps.push("npm run lint");
      nextSteps.push("npm run format");
    }

    if (nextSteps.length > 0) {
      log.message("");
      log.message(chalk.bold("Next steps:"));
      nextSteps.forEach((step, index) => {
        log.message(chalk.cyan(`  ${index + 1}. ${step}`));
      });
    }
  }

  private async handleError(error: unknown): Promise<void> {
    if (error instanceof SimpleCLIError) {
      cancel(error.message);

      if (error.showHelp) {
        log.message("");
        log.message("Run " + chalk.cyan("devboot add --help") + " for usage");
      }

      process.exit(error.exitCode);
    }

    if (error instanceof BaseError) {
      cancel(error.message);

      if (error instanceof LogicError) {
        log.message("");
        log.message(chalk.yellow(`💡 ${error.solution}`));
      }

      process.exit(1);
    }

    cancel(
      error instanceof Error ? error.message : "An unexpected error occurred"
    );
    process.exit(1);
  }
}
