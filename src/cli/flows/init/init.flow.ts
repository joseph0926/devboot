import chalk from "chalk";
import { intro, outro, note, cancel, confirm, isCancel } from "@clack/prompts";
import { ProjectAnalyzer } from "../../../core/project-analyzer";
import { LogicError } from "../../../errors/logic.error";
import { ModuleRegistry } from "../../../modules";
import { ProjectInfo, InstallOptionsOnly } from "../../../types/project.type";
import { ConfigChecker } from "../../helpers/config-checker";
import { DEVBOOT_LOGO } from "../../helpers/ui";
import {
  InstallationResult,
  InstallationStep,
} from "./steps/installation.step";
import { ModuleSelectionStep } from "./steps/module-selection.step";
import { ProjectValidationStep } from "./steps/project-validation.step";
import { CLIErrorHandler } from "../../../errors/cli/cli-error-handler";
import { ExitCodes } from "../../../types/exit-codes";
import { ErrorLogger } from "../../../utils/error-logger";

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

      if (this.isFullyConfigured(existingConfigs)) {
        this.showAlreadyConfiguredMessage();
        return;
      }

      const selectedModules = await this.selectModules(
        projectInfo,
        existingConfigs,
      );

      if (selectedModules.length === 0) {
        this.showNoModulesSelectedMessage();
        return;
      }

      if (!this.options.force) {
        await this.checkConflicts(existingConfigs, selectedModules);
      }

      if (!this.options.yes) {
        const confirmed = await this.confirmInstallationPlan(selectedModules);
        if (!confirmed) return;
      }

      const installResult = await this.installModules(
        selectedModules,
        projectPath,
      );

      this.showCompletionMessage(installResult);
    } catch (error) {
      CLIErrorHandler.handle(error, {
        verbose: this.options.verbose,
        showHelp: false,
      });
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
    if (!this.options.yes) {
      console.log(chalk.cyan(DEVBOOT_LOGO));
    }
    intro(chalk.cyan("🚀 DevBoot - Modern Development Environment Setup"));
  }

  private async analyzeProject(projectPath: string): Promise<ProjectInfo> {
    const analyzer = new ProjectAnalyzer();
    const projectInfo = await analyzer.analyze(projectPath);

    if (!this.options.yes) {
      const projectDetails = [
        `${chalk.bold("📦 Project:")} ${projectInfo.name}`,
        `${chalk.bold("🔧 Framework:")} ${this.getFrameworkDisplay(
          projectInfo.projectType,
        )}`,
        `${chalk.bold("📋 Package Manager:")} ${projectInfo.packageManager}`,
      ];

      if (projectInfo.hasTypeScript) {
        projectDetails.push(`${chalk.bold("📘 TypeScript:")} ✓ Detected`);
      }

      note(projectDetails.join("\n"), "Project Analysis");
    }

    return projectInfo;
  }

  private getFrameworkDisplay(projectType: string): string {
    const frameworks: Record<string, string> = {
      nextjs: "Next.js",
      react: "React",
      vue: "Vue.js",
      node: "Node.js",
      unknown: "Unknown",
    };
    return frameworks[projectType] || projectType;
  }

  private async checkExistingConfigs(projectPath: string): Promise<string[]> {
    try {
      const configs = await ConfigChecker.checkExistingConfigs(projectPath);

      if (configs.length > 0 && !this.options.yes && !this.options.force) {
        const configList = configs
          .map((config) => `  • ${this.getConfigDisplay(config)}`)
          .join("\n");

        note(
          `Found existing configurations:\n${chalk.yellow(configList)}`,
          "⚠️  Existing Setup",
        );
      }

      return configs;
    } catch (error) {
      ErrorLogger.logWarning(`Config check warning: ${error}`);
      return [];
    }
  }

  private getConfigDisplay(config: string): string {
    const displays: Record<string, string> = {
      "eslint-prettier": "ESLint + Prettier",
      "git-hooks": "Git Hooks (Husky)",
      typescript: "TypeScript Config",
      editorconfig: "EditorConfig",
    };
    return displays[config] || config;
  }

  private isFullyConfigured(existingConfigs: string[]): boolean {
    const essentialModules = ["eslint-prettier", "git-hooks"];
    return essentialModules.every((module) => existingConfigs.includes(module));
  }

  private showAlreadyConfiguredMessage(): void {
    outro(chalk.green("✅ Your project is already fully configured!"));
    console.log(chalk.gray("\nTo add more tools, use:"));
    console.log(chalk.cyan("  devboot add <module-name>"));
    console.log(chalk.gray("\nAvailable modules:"));
    ModuleRegistry.getAll().forEach((module) => {
      console.log(chalk.gray(`  • ${module.name} - ${module.description}`));
    });
  }

  private async selectModules(
    projectInfo: ProjectInfo,
    existingConfigs: string[],
  ): Promise<string[]> {
    if (this.options.yes) {
      return this.getDefaultModulesForProject(projectInfo, existingConfigs);
    }

    const selectedModules = await ModuleSelectionStep.selectModules({
      existingConfigs,
      projectInfo,
      isInteractive: true,
    });

    return selectedModules;
  }

  private getDefaultModulesForProject(
    projectInfo: ProjectInfo,
    existingConfigs: string[],
  ): string[] {
    const modules = [];

    if (!existingConfigs.includes("eslint-prettier")) {
      modules.push("eslint-prettier");
    }
    if (!existingConfigs.includes("git-hooks")) {
      modules.push("git-hooks");
    }
    if (!existingConfigs.includes("editorconfig")) {
      modules.push("editorconfig");
    }

    if (projectInfo.hasTypeScript && !existingConfigs.includes("typescript")) {
      modules.push("typescript");
    }

    return modules;
  }

  private showNoModulesSelectedMessage(): void {
    console.log(chalk.yellow("\n⚠  No modules selected"));
    outro("Nothing to do. Run 'devboot init' again when you're ready!");
  }

  private async checkConflicts(
    existingConfigs: string[],
    selectedModules: string[],
  ): Promise<void> {
    const { hasConflicts, errors } = ConfigChecker.checkConflicts(
      existingConfigs,
      selectedModules,
    );

    if (hasConflicts) {
      console.log(chalk.red("\n⚠️  Configuration conflicts detected:"));

      errors.forEach((error) => {
        ErrorLogger.logError(error, {
          verbose: false,
          showSolution: true,
          prefix: false,
        });
      });

      const shouldContinue = await confirm({
        message: "Continue anyway?",
        initialValue: false,
      });

      if (isCancel(shouldContinue) || !shouldContinue) {
        cancel("Setup cancelled");
        process.exit(ExitCodes.USER_CANCELLED);
      }
    }
  }

  private async confirmInstallationPlan(
    selectedModules: string[],
  ): Promise<boolean> {
    const planDetails = selectedModules
      .map((mod) => {
        const module = ModuleRegistry.get(mod);
        return module
          ? `  • ${chalk.bold(module.displayName)} - ${chalk.gray(
              module.description,
            )}`
          : `  • ${mod}`;
      })
      .join("\n");

    note(
      `The following tools will be configured:\n${chalk.green(planDetails)}`,
      "📋 Installation Plan",
    );

    const shouldProceed = await confirm({
      message: "Proceed with installation?",
      initialValue: true,
    });

    if (isCancel(shouldProceed) || !shouldProceed) {
      cancel("Setup cancelled");
      return false;
    }

    return true;
  }

  private async installModules(
    selectedModules: string[],
    projectPath: string,
  ): Promise<InstallationResult> {
    const installOptions: InstallOptionsOnly = {
      verbose: this.options.verbose,
      dryRun: this.options.dryRun,
      force: this.options.force,
    };

    return InstallationStep.installModules(
      selectedModules,
      projectPath,
      installOptions,
    );
  }

  private showCompletionMessage(result: InstallationResult): void {
    if (result.successful.length > 0) {
      outro(chalk.green("✨ DevBoot setup complete!"));
      this.showNextSteps(result.successful);
    } else {
      outro(chalk.red("❌ Setup failed"));
    }

    if (result.failed.length > 0) {
      ErrorLogger.logErrorSummary(result.failed.map((f) => f.error));
    }
  }

  private showNextSteps(installedModules: string[]): void {
    console.log("\n" + chalk.bold("🎯 Next steps:"));

    const nextSteps: Record<string, string[]> = {
      "eslint-prettier": [
        `Run ${chalk.cyan("npm run lint")} to check your code`,
        `Run ${chalk.cyan("npm run format")} to format your code`,
      ],
      "git-hooks": [
        `Stage your changes with ${chalk.cyan("git add .")}`,
        `Commit with ${chalk.cyan(
          "git commit -m 'Add dev tools'",
        )} - hooks will run automatically`,
      ],
      typescript: [
        `TypeScript is now optimized for your ${this.getFrameworkDisplay(
          "react",
        )} project`,
      ],
      editorconfig: [
        `Your editor will now respect ${chalk.cyan(".editorconfig")} settings`,
      ],
    };

    installedModules.forEach((module) => {
      if (nextSteps[module]) {
        nextSteps[module].forEach((step) => {
          console.log(chalk.gray(`  • ${step}`));
        });
      }
    });

    console.log("\n" + chalk.gray("To add more tools later:"));
    console.log(chalk.cyan("  devboot add <module-name>"));
    console.log("");
  }
}
