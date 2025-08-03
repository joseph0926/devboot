import chalk from "chalk";
import { intro, outro, note, cancel, confirm, isCancel } from "@clack/prompts";
import { ProjectAnalyzer } from "../../../core/project-analyzer";
import { LogicError } from "../../../errors/logic.error";
import { ModuleRegistry } from "../../../modules";
import { ProjectInfo, InstallOptionsOnly } from "../../../types/project.type";
import { logger } from "../../../utils/logger";
import { ConfigChecker } from "../../helpers/config-checker";
import { DEVBOOT_LOGO } from "../../helpers/ui";
import {
  InstallationResult,
  InstallationStep,
} from "./steps/installation.step";
import { ModuleSelectionStep } from "./steps/module-selection.step";
import { ProjectValidationStep } from "./steps/project-validation.step";

export interface InitCommandOptions {
  yes?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export class InitFlow {
  constructor(private options: InitCommandOptions) {}

  async execute(): Promise<void> {
    try {
      const projectPath = process.cwd();

      await this.validateProject(projectPath);

      this.showWelcome();

      const projectInfo = await this.analyzeProject(projectPath);

      const existingConfigs = await this.checkExistingConfigs(projectPath);

      const selectedModules = await this.selectModules(
        projectInfo,
        existingConfigs
      );

      await this.checkConflicts(existingConfigs, selectedModules);

      if (!this.options.yes) {
        await this.confirmInstallationPlan(selectedModules);
      }

      const installResult = await this.installModules(
        selectedModules,
        projectPath
      );

      this.showCompletionMessage(installResult);
    } catch (error) {
      this.handleError(error);
    }
  }

  private async validateProject(projectPath: string): Promise<void> {
    try {
      await ProjectValidationStep.validate(projectPath);
    } catch (error) {
      if (error instanceof LogicError) {
        ProjectValidationStep.showProjectCreationHints();
      }
      throw error;
    }
  }

  private showWelcome(): void {
    if (!this.options.yes && !this.options.verbose) {
      console.log(chalk.cyan(DEVBOOT_LOGO));
    }
    intro(chalk.cyan("Welcome to DevBoot!"));
  }

  private async analyzeProject(projectPath: string): Promise<ProjectInfo> {
    const analyzer = new ProjectAnalyzer();
    const projectInfo = await analyzer.analyze(projectPath);

    if (!this.options.yes) {
      note(
        `${chalk.bold("Project:")} ${projectInfo.name}\n` +
          `${chalk.bold("Type:")} ${projectInfo.projectType}\n` +
          `${chalk.bold("Package Manager:")} ${projectInfo.packageManager}`,
        "Project detected"
      );
    }

    return projectInfo;
  }

  private async checkExistingConfigs(projectPath: string): Promise<string[]> {
    try {
      const configs = await ConfigChecker.checkExistingConfigs(projectPath);

      if (configs.length > 0 && !this.options.yes) {
        const configList = ConfigChecker.formatConfigList(configs);
        note(
          `Found existing configurations:\n${chalk.yellow(configList)}`,
          "⚠️  Warning"
        );
      }

      return configs;
    } catch (error) {
      if (error instanceof LogicError && !error.isRecoverable) {
        throw error;
      }
      logger.warn(`Config check warning: ${error}`);
      return [];
    }
  }

  private async selectModules(
    projectInfo: ProjectInfo,
    existingConfigs: string[]
  ): Promise<string[]> {
    const selectedModules = await ModuleSelectionStep.selectModules({
      existingConfigs,
      projectInfo,
      isInteractive: !this.options.yes,
    });

    if (selectedModules.length === 0) {
      console.log(chalk.yellow("\n⚠  No modules selected"));
      outro("Nothing to do. Run 'devboot init' again when you're ready!");
      process.exit(0);
    }

    return selectedModules;
  }

  private async checkConflicts(
    existingConfigs: string[],
    selectedModules: string[]
  ): Promise<void> {
    if (this.options.force) return;

    const { hasConflicts, errors } = ConfigChecker.checkConflicts(
      existingConfigs,
      selectedModules
    );

    if (hasConflicts) {
      console.log(chalk.red("\n⚠️  Configuration conflicts detected:"));

      errors.forEach((error) => {
        console.log(chalk.red(`  • ${error.message}`));
        if (error.solution) {
          console.log(chalk.yellow(`    💡 ${error.solution}`));
        }
      });

      const shouldContinue = await confirm({
        message: "Continue despite conflicts?",
        initialValue: false,
      });

      if (isCancel(shouldContinue) || !shouldContinue) {
        cancel("Setup cancelled due to conflicts");
        process.exit(0);
      }
    }
  }

  private async confirmInstallationPlan(
    selectedModules: string[]
  ): Promise<void> {
    const planDetails = selectedModules
      .map((mod) => {
        const module = ModuleRegistry.get(mod);
        return module
          ? `  • ${module.displayName} - ${module.description}`
          : `  • ${mod}`;
      })
      .join("\n");

    note(`Will set up:\n${chalk.green(planDetails)}`, "Installation plan");

    const shouldProceed = await confirm({
      message: "Proceed with installation?",
      initialValue: true,
    });

    if (isCancel(shouldProceed) || !shouldProceed) {
      cancel("Setup cancelled");
      process.exit(0);
    }
  }

  private async installModules(
    selectedModules: string[],
    projectPath: string
  ): Promise<InstallationResult> {
    const installOptions: InstallOptionsOnly = {
      verbose: this.options.verbose,
      dryRun: this.options.dryRun,
      force: this.options.force,
    };

    return InstallationStep.installModules(
      selectedModules,
      projectPath,
      installOptions
    );
  }

  private showCompletionMessage(result: InstallationResult): void {
    if (result.successful.length > 0) {
      outro(chalk.green("✨ All done!"));
      this.showNextSteps(result.successful);
    } else {
      outro(chalk.red("❌ Installation failed"));
    }

    if (result.failed.length > 0) {
      console.log(chalk.red("\n⚠️  Failed modules:"));
      result.failed.forEach(({ module, error }) => {
        console.log(chalk.red(`  • ${module}: ${error.message}`));
      });
    }
  }

  private showNextSteps(installedModules: string[]): void {
    console.log("\n" + chalk.bold("Next steps:"));

    const nextSteps: Record<string, () => void> = {
      editorconfig: () =>
        console.log(
          chalk.gray("  • Your editor will now use") +
            chalk.cyan(" .editorconfig") +
            chalk.gray(" for consistent code style")
        ),
      "eslint-prettier": () => {
        console.log(
          chalk.gray("  • Run") +
            chalk.cyan(" npm run lint") +
            chalk.gray(" to check your code")
        );
        console.log(
          chalk.gray("  • Run") +
            chalk.cyan(" npm run format") +
            chalk.gray(" to format your code")
        );
      },
      "git-hooks": () =>
        console.log(
          chalk.gray("  • Commit your code - hooks will run automatically")
        ),
      typescript: () =>
        console.log(
          chalk.gray("  • TypeScript is now configured for your project")
        ),
    };

    installedModules.forEach((module) => {
      if (nextSteps[module]) {
        nextSteps[module]();
      }
    });

    console.log("");
  }

  private handleError(error: unknown): never {
    console.log("");

    if (error instanceof LogicError) {
      logger.error(error.message);

      if (error.solution) {
        console.log(chalk.yellow(`\n💡 ${error.solution}`));
      }

      if (error.context && this.options.verbose) {
        console.log(chalk.gray("\nError context:"));
        console.log(chalk.gray(JSON.stringify(error.context, null, 2)));
      }
    } else if (error instanceof Error) {
      logger.error(error.message);

      if (this.options.verbose) {
        console.log(chalk.gray("\nStack trace:"));
        console.log(chalk.gray(error.stack));
      }
    } else {
      logger.error("An unexpected error occurred");
    }

    process.exit(1);
  }
}

export const initFlow = async (options: InitCommandOptions): Promise<void> => {
  const flow = new InitFlow(options);
  await flow.execute();
};
