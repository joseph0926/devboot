import { ConfigDetector } from "../../core/config-detector";
import { LogicError, SimpleLogicError } from "../../errors/logic.error";
import { ConfigConflictError } from "../../errors/logic/config.error";
import { ConfigMetadataRegistry } from "../../meta/config.meta";
import { LogicErrorCodes } from "../../types/error.type";
import { logger } from "../../utils/logger";

export class ConfigChecker {
  static async checkExistingConfigs(projectPath: string): Promise<string[]> {
    try {
      const configs = await ConfigDetector.detectInstalledConfigs(projectPath);
      return configs.map((config) => config.name);
    } catch (error) {
      if (error instanceof LogicError) {
        logger.error(`Config check failed: ${error.message}`);

        if (error.solution) {
          logger.info(`💡 ${error.solution}`);
        }

        if (error.isRecoverable) {
          return [];
        }

        throw error;
      }

      throw error;
    }
  }

  static async getDetailedConfigInfo(projectPath: string) {
    try {
      const configs = await ConfigDetector.detectInstalledConfigs(projectPath);
      const categorized = ConfigDetector.categorizeConfigs(configs);

      return {
        all: configs,
        categorized,
        details: configs.map((config) => ({
          ...config,
          metadata: ConfigMetadataRegistry.get(config.name),
        })),
      };
    } catch (error) {
      if (error instanceof LogicError) {
        throw error;
      }

      throw new SimpleLogicError(
        LogicErrorCodes.CONFIG_READ_ERROR,
        "Failed to get detailed config info",
        false,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  static formatConfigList(configs: string[]): string {
    return configs
      .map((config) => {
        const metadata = ConfigMetadataRegistry.get(config);
        return metadata
          ? `  • ${metadata.displayName} - ${metadata.description}`
          : `  • ${config}`;
      })
      .join("\n");
  }

  static checkConflicts(
    installedConfigs: string[],
    selectedModules: string[]
  ): {
    hasConflicts: boolean;
    conflicts: Array<{ module: string; conflictsWith: string }>;
    errors: LogicError[];
  } {
    const conflicts: Array<{ module: string; conflictsWith: string }> = [];
    const errors: LogicError[] = [];

    for (const module of selectedModules) {
      try {
        const metadata = ConfigMetadataRegistry.get(module);
        if (!metadata?.conflictsWith) continue;

        const conflictingConfigs = metadata.conflictsWith.filter((conflict) =>
          installedConfigs.includes(conflict)
        );

        if (conflictingConfigs.length > 0) {
          conflicts.push(
            ...conflictingConfigs.map((conflict) => ({
              module,
              conflictsWith: conflict,
            }))
          );

          errors.push(
            new ConfigConflictError(
              `Configuration '${module}' conflicts with installed configurations`,
              {
                configName: module,
                conflicts: conflictingConfigs,
              }
            )
          );
        }
      } catch (error) {
        logger.warn(`Failed to check conflicts for ${module}: ${error}`);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      errors,
    };
  }
}
