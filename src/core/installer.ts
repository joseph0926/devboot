import { ModuleRegistry } from "../modules";
import { InstallResult } from "../modules/base.module";
import type {
  ProjectContext,
  InstallOptionsOnly,
  InstallOptions,
} from "../types/project.type";
import { PackageManagerService } from "./package-manager";
import { ProjectAnalyzer } from "./project-analyzer";

export class ModuleInstaller {
  private projectAnalyzer: ProjectAnalyzer;
  private packageManager: PackageManagerService;

  constructor() {
    this.projectAnalyzer = new ProjectAnalyzer();
    this.packageManager = new PackageManagerService();
  }

  async prepareContext(
    projectPath: string = process.cwd()
  ): Promise<ProjectContext> {
    const projectInfo = await this.projectAnalyzer.analyze(projectPath);

    return {
      projectPath,
      packageJson: projectInfo.packageJson,
      packageManager: projectInfo.packageManager,
      projectType: projectInfo.projectType,
      hasTypeScript: projectInfo.hasTypeScript,
    };
  }

  async installModule(
    moduleName: string,
    projectPath: string = process.cwd(),
    options: InstallOptionsOnly = {}
  ): Promise<InstallResult> {
    const module = ModuleRegistry.get(moduleName);

    if (!module) {
      return {
        success: false,
        errors: [new Error(`Module '${moduleName}' not found`)],
      };
    }

    try {
      const context = await this.prepareContext(projectPath);

      const fullOptions: InstallOptions = {
        ...context,
        ...options,
      };

      const result = await module.install(fullOptions);

      if (result.success && !options.dryRun) {
        const deps = await module.getDependencies(fullOptions);
        const packagesResult = await this.packageManager.install(deps, {
          packageManager: context.packageManager,
          projectPath: context.projectPath,
          verbose: options.verbose,
        });

        if (packagesResult.success) {
          result.installedPackages = packagesResult.installed;
        } else {
          result.success = false;
          result.errors?.push(packagesResult.error!);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [error as Error],
      };
    }
  }
}
