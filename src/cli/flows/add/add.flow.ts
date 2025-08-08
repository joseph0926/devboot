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

      this.showStartMessage(validatedModules, options);

      if (options.dryRun) {
        await this.handleDryRun(validatedModules);
        return;
      }

      const results = await this.installModules(validatedModules, options);

      this.showResults(results);
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
            "Not in a Node.js project",
            true,
            1,
            false,
            {
              currentPath: projectPath,
              suggestion: "Run this command in a directory with package.json",
            },
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
        { originalError: error },
      );
    }
  }

  private async validateModules(moduleNames: string[]): Promise<string[]> {
    const availableModules = ModuleRegistry.list();
    const invalidModules = moduleNames.filter(
      (name) => !availableModules.includes(name),
    );

    if (invalidModules.length > 0) {
      this.showInvalidModulesError(invalidModules);
      throw new SimpleCLIError(
        CLIErrorCodes.INVALID_ARGUMENT,
        "Invalid module names provided",
        true,
        1,
        false,
        { invalidModules, availableModules },
      );
    }

    return [...new Set(moduleNames)];
  }

  private showInvalidModulesError(invalidModules: string[]): void {
    log.error(
      `${chalk.red("❌ Invalid modules:")} ${invalidModules.join(", ")}`,
    );
    log.message("");
    log.message(chalk.yellow("📦 Available modules:"));

    ModuleRegistry.getAll().forEach((module) => {
      log.message(
        `  ${chalk.cyan(module.name.padEnd(20))} ${chalk.gray(
          module.description,
        )}`,
      );
    });

    log.message("");
    log.message(chalk.gray("Example:"));
    log.message(chalk.cyan("  devboot add eslint prettier typescript"));
  }

  private showStartMessage(modules: string[], options: AddFlowOptions): void {
    const action = options.dryRun ? "Checking" : "Adding";
    const moduleText = modules.length === 1 ? "module" : "modules";

    intro(
      chalk.cyan(`${action} ${modules.length} ${moduleText} to your project`),
    );
  }

  private async handleDryRun(modules: string[]): Promise<void> {
    log.info(chalk.blue("🔍 Dry run mode - no changes will be made"));
    log.message("");

    const context = await this.moduleInstaller.prepareContext(process.cwd());

    for (const moduleName of modules) {
      const module = ModuleRegistry.get(moduleName);
      if (!module) continue;

      log.message(chalk.bold(`\n📦 ${module.displayName}`));
      log.message(chalk.gray(`   ${module.description}`));

      const moduleClass = ModuleRegistry.get(moduleName);
      if (!moduleClass) {
        throw new Error(`Module '${moduleName}' not found in registry`);
      }
      const moduleInstance = { default: moduleClass };
      const filesToCreate = await moduleInstance.default.getFilesToCreate(context);
      if (filesToCreate.size > 0) {
        log.message(chalk.gray("\n   Files that would be created:"));
        for (const [file] of filesToCreate) {
          log.message(chalk.gray(`   • ${file}`));
        }
      }

      const dependencies = await moduleInstance.default.getDependencies(context);
      if (dependencies.dependencies || dependencies.devDependencies) {
        log.message(chalk.gray("\n   Packages that would be installed:"));
        Object.keys(dependencies.dependencies || {}).forEach((dep: string) => {
          log.message(chalk.gray(`   • ${dep}`));
        });
        Object.keys(dependencies.devDependencies || {}).forEach((dep: string) => {
          log.message(chalk.gray(`   • ${dep} (dev)`));
        });
      }
    }

    outro(chalk.green("✅ Dry run complete!"));
  }

  private async installModules(
    moduleNames: string[],
    options: AddFlowOptions,
  ): Promise<Map<string, InstallResult>> {
    const results = new Map<string, InstallResult>();
    const context = await this.moduleInstaller.prepareContext(process.cwd());

    if (options.verbose) {
      this.showProjectInfo(context);
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
          },
        );

        results.set(moduleName, result);

        if (result.success) {
          s.stop(`${chalk.green("✓")} ${module.displayName} installed`);
          this.showInstallDetails(result, options.verbose);
        } else {
          s.stop(`${chalk.red("✗")} Failed to install ${module.displayName}`);
          this.showInstallErrors(result);
        }
      } catch (error) {
        s.stop(`${chalk.red("✗")} Failed to install ${module.displayName}`);
        this.handleInstallError(moduleName, error, results);
      }
    }

    return results;
  }

  private showProjectInfo(context: any): void {
    log.message("");
    log.info(chalk.dim("📊 Project details:"));
    log.message(chalk.dim(`  • Type: ${context.projectType}`));
    log.message(
      chalk.dim(`  • TypeScript: ${context.hasTypeScript ? "Yes" : "No"}`),
    );
    log.message(chalk.dim(`  • Package Manager: ${context.packageManager}`));
    log.message("");
  }

  private showInstallDetails(result: InstallResult, verbose: boolean): void {
    if (verbose && result.installedFiles?.length) {
      result.installedFiles.forEach((file) => {
        log.message(chalk.dim(`    Created: ${file}`));
      });
    }

    if (verbose && result.installedPackages?.length) {
      const pkgCount = result.installedPackages.length;
      log.message(
        chalk.dim(
          `    Installed ${pkgCount} package${pkgCount > 1 ? "s" : ""}`,
        ),
      );
    }

    if (result.hints?.length) {
      result.hints.forEach((hint) => {
        log.message(chalk.yellow(`    💡 ${hint}`));
      });
    }
  }

  private showInstallErrors(result: InstallResult): void {
    if (result.errors?.length) {
      result.errors.forEach((error) => {
        log.error(`    ${error.message}`);
        if (error instanceof LogicError && error.solution) {
          log.message(chalk.yellow(`    💡 ${error.solution}`));
        }
      });
    }
  }

  private handleInstallError(
    moduleName: string,
    error: unknown,
    results: Map<string, InstallResult>,
  ): void {
    const errorResult: InstallResult = {
      success: false,
      errors: [
        error instanceof BaseError
          ? error
          : new SimpleLogicError(
              LogicErrorCodes.MODULE_INSTALL_FAILED,
              error instanceof Error ? error.message : String(error),
              false,
              { module: moduleName },
            ),
      ],
    };

    results.set(moduleName, errorResult);

    if (error instanceof BaseError) {
      log.error(`    ${error.message}`);
      if (error instanceof LogicError && error.solution) {
        log.message(chalk.yellow(`    💡 ${error.solution}`));
      }
    } else {
      log.error(
        `    ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private showResults(results: Map<string, InstallResult>): void {
    const successful = Array.from(results.entries()).filter(
      ([_, result]) => result.success,
    );
    const failed = Array.from(results.entries()).filter(
      ([_, result]) => !result.success,
    );

    if (successful.length > 0) {
      outro(
        chalk.green(
          `✨ Successfully installed ${successful.length} module${
            successful.length > 1 ? "s" : ""
          }!`,
        ),
      );
      this.showNextSteps(successful.map(([name]) => name));
    } else if (failed.length > 0) {
      outro(chalk.red("❌ Installation failed"));
    }

    if (failed.length > 0) {
      console.log(chalk.red("\n⚠️  Failed modules:"));
      failed.forEach(([name, result]) => {
        const module = ModuleRegistry.get(name);
        console.log(chalk.red(`  • ${module?.displayName || name}`));
        if (result.errors?.[0]) {
          console.log(chalk.red(`    ${result.errors[0].message}`));
        }
      });
    }
  }

  private showNextSteps(installedModules: string[]): void {
    const steps: string[] = [];

    if (installedModules.includes("eslint")) {
      steps.push(`${chalk.cyan("npm run lint")} - Check your code`);
    }

    if (installedModules.includes("prettier")) {
      steps.push(`${chalk.cyan("npm run format")} - Format your code`);
    }

    if (installedModules.includes("editorconfig")) {
      steps.push("Restart your editor to apply .editorconfig settings");
    }

    if (installedModules.includes("typescript")) {
      steps.push(`${chalk.cyan("npm run typecheck")} - Check TypeScript types`);
    }

    if (steps.length > 0) {
      console.log("");
      console.log(chalk.bold("🎯 Next steps:"));
      steps.forEach((step) => {
        console.log(chalk.gray(`  • ${step}`));
      });
    }

    console.log("");
    console.log(chalk.gray("To add more tools:"));
    console.log(chalk.cyan("  devboot add <module-name>"));
    console.log("");
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

      if (error instanceof LogicError && error.solution) {
        log.message("");
        log.message(chalk.yellow(`💡 ${error.solution}`));
      }

      process.exit(1);
    }

    cancel(
      error instanceof Error ? error.message : "An unexpected error occurred",
    );
    process.exit(1);
  }
}
