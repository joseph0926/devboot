import { spinner } from "@clack/prompts";
import chalk from "chalk";
import { ModuleInstaller } from "../../../../core/installer";
import { BaseError } from "../../../../errors/base.error";
import { InstallOptionsOnly } from "../../../../types/project.type";
import { logger } from "../../../../utils/logger";
import { LogicError } from "../../../../errors/logic.error";

export interface InstallationResult {
  successful: string[];
  failed: Array<{ module: string; error: BaseError }>;
}

export class InstallationStep {
  static async installModules(
    modules: string[],
    projectPath: string,
    options: InstallOptionsOnly,
  ): Promise<InstallationResult> {
    const installer = new ModuleInstaller();
    const result: InstallationResult = {
      successful: [],
      failed: [],
    };

    console.log("");
    const s = spinner();

    for (const moduleName of modules) {
      s.start(`Installing ${moduleName}`);

      try {
        const installResult = await installer.installModule(
          moduleName,
          projectPath,
          options,
        );

        if (installResult.success) {
          s.stop(`${chalk.green("✓")} ${moduleName} installed`);
          result.successful.push(moduleName);

          if (options.verbose && installResult.installedFiles?.length) {
            installResult.installedFiles.forEach((file) => {
              logger.debug(`  Created: ${file}`);
            });
          }
        } else {
          s.stop(`${chalk.red("✗")} Failed to install ${moduleName}`);

          installResult.errors?.forEach((err) => {
            logger.error(`  ${err.message}`);
            if (err instanceof LogicError && err.solution) {
              logger.info(`  💡 ${err.solution}`);
            }
          });

          const firstError = installResult.errors?.[0];
          if (firstError) {
            result.failed.push({
              module: moduleName,
              error: firstError,
            });
          }
        }
      } catch (error) {
        s.stop(`${chalk.red("✗")} Failed to install ${moduleName}`);

        if (error instanceof BaseError) {
          result.failed.push({ module: moduleName, error });
        } else {
          throw error;
        }
      }
    }

    return result;
  }
}
