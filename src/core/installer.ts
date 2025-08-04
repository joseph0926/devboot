import { BaseError } from "../errors/base.error";
import { SimpleLogicError } from "../errors/logic.error";
import { ModuleRegistry } from "../modules";
import { InstallResult } from "../modules/base.module";
import { LogicErrorCodes } from "../types/error.type";
import type {
  ProjectContext,
  InstallOptionsOnly,
  InstallOptions,
} from "../types/project.type";
import { findSimilar } from "../utils/string";
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
    projectPath: string = process.cwd(),
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
    options: InstallOptionsOnly = {},
  ): Promise<InstallResult> {
    const module = ModuleRegistry.get(moduleName);

    if (!module) {
      const availableModules = ModuleRegistry.list();
      const similarModules = findSimilar(moduleName, availableModules);

      throw new SimpleLogicError(
        LogicErrorCodes.MODULE_NOT_FOUND,
        `Module '${moduleName}' not found`,
        false,
        {
          moduleName,
          availableModules,
          similarModules,
          requestedAt: projectPath,
        },
        similarModules.length > 0
          ? `Module '${moduleName}' not found. Did you mean '${similarModules[0]}'?`
          : `Available modules: ${availableModules.join(", ")}`,
      );
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

        try {
          const packagesResult = await this.packageManager.install(deps, {
            packageManager: context.packageManager,
            projectPath: context.projectPath,
            verbose: options.verbose,
          });

          if (packagesResult.success) {
            result.installedPackages = packagesResult.installed;
          }
        } catch (error) {
          result.success = false;

          if (!result.errors) {
            result.errors = [];
          }

          if (error instanceof BaseError) {
            result.errors.push(error);
          } else {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            result.errors.push(
              new SimpleLogicError(
                LogicErrorCodes.MODULE_INSTALL_FAILED,
                `Package installation failed: ${errorMessage}`,
                true,
                {
                  moduleName,
                  originalError: errorMessage,
                },
              ),
            );
          }
        }
      }

      return result;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new SimpleLogicError(
        LogicErrorCodes.MODULE_INSTALL_FAILED,
        errorMessage,
        false,
        {
          moduleName,
          projectPath,
          originalError: errorMessage,
        },
      );
    }
  }
}
