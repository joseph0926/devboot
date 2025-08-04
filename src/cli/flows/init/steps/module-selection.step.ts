import { multiselect, isCancel } from "@clack/prompts";
import chalk from "chalk";
import { ModuleRegistry } from "../../../../modules";
import { ProjectInfo } from "../../../../types/project.type";

export interface ModuleSelectionOptions {
  existingConfigs: string[];
  projectInfo: ProjectInfo;
  isInteractive: boolean;
}

export class ModuleSelectionStep {
  static async selectModules(
    options: ModuleSelectionOptions,
  ): Promise<string[]> {
    if (!options.isInteractive) {
      return this.getDefaultModules();
    }

    this.showSelectionGuide();

    const moduleOptions = this.buildModuleOptions(options);
    const selected = await multiselect({
      message: "Select tools to set up:",
      options: moduleOptions,
      initialValues: this.getRecommendedModules(options),
      required: false,
    });

    if (isCancel(selected)) {
      throw new Error("Setup cancelled by user");
    }

    return selected as string[];
  }

  private static getDefaultModules(): string[] {
    return ["editorconfig"];
  }

  private static getRecommendedModules(
    options: ModuleSelectionOptions,
  ): string[] {
    const recommended = [];

    if (!options.existingConfigs.includes("editorconfig")) {
      recommended.push("editorconfig");
    }

    if (
      options.projectInfo.hasTypeScript &&
      !options.existingConfigs.includes("typescript")
    ) {
      recommended.push("typescript");
    }

    return recommended;
  }

  private static buildModuleOptions(options: ModuleSelectionOptions) {
    const availableModules = ModuleRegistry.getAll();

    return availableModules.map((module) => {
      const isInstalled = options.existingConfigs.includes(module.name);
      const isRecommended = this.getRecommendedModules(options).includes(
        module.name,
      );

      return {
        value: module.name,
        label: module.displayName,
        hint: this.getModuleHint(
          module.name,
          isInstalled,
          isRecommended,
          options,
        ),
      };
    });
  }

  private static getModuleHint(
    moduleName: string,
    isInstalled: boolean,
    isRecommended: boolean,
    options: ModuleSelectionOptions,
  ): string {
    if (isInstalled) {
      return chalk.yellow("⚠ already configured");
    }

    if (isRecommended) {
      return chalk.green("✓ recommended");
    }

    if (moduleName === "typescript" && options.projectInfo.hasTypeScript) {
      return chalk.blue("detected in project");
    }

    return "";
  }

  private static showSelectionGuide(): void {
    console.log("");
    console.log(chalk.gray("  📋 How to select:"));
    console.log(chalk.gray("  │"));
    console.log(chalk.gray("  ├─ Use ↑↓ arrows to navigate"));
    console.log(chalk.gray("  ├─ Press Space to select/unselect"));
    console.log(chalk.gray("  └─ Press Enter when done"));
    console.log("");
  }
}
