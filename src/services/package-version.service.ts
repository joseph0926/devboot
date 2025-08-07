import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { SimpleLogicError } from '../errors/logic.error.js';
import { LogicErrorCodes } from '../types/error.type.js';

const execAsync = promisify(exec);

export type VersionStrategy = 'latest' | 'stable' | 'manual' | 'prompt';

export interface PackageVersionConfig {
  strategy: VersionStrategy;
  fallbackVersion?: string;
  preferredVersion?: string;
}

export interface PackageVersionInfo {
  name: string;
  version: string;
  strategy: VersionStrategy;
  isLatest: boolean;
}

export class PackageVersionService {
  private static readonly VERSION_CACHE = new Map<
    string,
    { version: string; timestamp: number }
  >();
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  async getPackageVersion(
    packageName: string,
    config: PackageVersionConfig
  ): Promise<PackageVersionInfo> {
    switch (config.strategy) {
      case 'latest':
        return this.getLatestVersion(packageName, config.fallbackVersion);

      case 'stable':
        return this.getStableVersion(packageName, config.fallbackVersion);

      case 'manual':
        if (!config.preferredVersion) {
          throw new SimpleLogicError(
            LogicErrorCodes.INVALID_PACKAGE_MANAGER,
            `Manual strategy requires preferredVersion for ${packageName}`,
            false
          );
        }
        return {
          name: packageName,
          version: config.preferredVersion,
          strategy: 'manual',
          isLatest: false,
        };

      case 'prompt':
        return {
          name: packageName,
          version: config.fallbackVersion || 'latest',
          strategy: 'prompt',
          isLatest: false,
        };

      default:
        throw new SimpleLogicError(
          LogicErrorCodes.INVALID_PACKAGE_MANAGER,
          `Unknown version strategy: ${config.strategy}`,
          false
        );
    }
  }

  private async getLatestVersion(
    packageName: string,
    fallbackVersion?: string
  ): Promise<PackageVersionInfo> {
    try {
      const cached = this.getCachedVersion(packageName);
      if (cached) {
        return {
          name: packageName,
          version: cached,
          strategy: 'latest',
          isLatest: true,
        };
      }

      const { stdout } = await execAsync(`npm view ${packageName} version`, {
        timeout: 10000,
      });

      const version = stdout.trim();

      this.setCachedVersion(packageName, version);

      return {
        name: packageName,
        version,
        strategy: 'latest',
        isLatest: true,
      };
    } catch (error) {
      if (fallbackVersion) {
        logger.warn(
          `Failed to fetch latest version for ${packageName}, using fallback: ${fallbackVersion}`
        );
        return {
          name: packageName,
          version: fallbackVersion,
          strategy: 'latest',
          isLatest: false,
        };
      }

      throw new SimpleLogicError(
        LogicErrorCodes.NETWORK_ERROR,
        `Failed to fetch version for ${packageName}`,
        true,
        {
          packageName,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  private async getStableVersion(
    packageName: string,
    fallbackVersion?: string
  ): Promise<PackageVersionInfo> {
    try {
      const { stdout } = await execAsync(
        `npm view ${packageName} versions --json`,
        {
          timeout: 10000,
        }
      );

      const versions: string[] = JSON.parse(stdout);

      const stableVersions = versions.filter(
        (v) =>
          !v.includes('-alpha') &&
          !v.includes('-beta') &&
          !v.includes('-rc') &&
          !v.includes('-canary') &&
          !v.includes('-next')
      );

      if (stableVersions.length === 0) {
        throw new Error('No stable versions found');
      }

      const latestStable = stableVersions[stableVersions.length - 1]!;

      return {
        name: packageName,
        version: latestStable,
        strategy: 'stable',
        isLatest: false,
      };
    } catch (error) {
      if (fallbackVersion) {
        logger.warn(
          `Failed to fetch stable version for ${packageName}, using fallback: ${fallbackVersion}`
        );
        return {
          name: packageName,
          version: fallbackVersion,
          strategy: 'stable',
          isLatest: false,
        };
      }

      try {
        return await this.getLatestVersion(packageName, fallbackVersion);
      } catch {
        throw new SimpleLogicError(
          LogicErrorCodes.NETWORK_ERROR,
          `Failed to fetch stable version for ${packageName}`,
          true,
          {
            packageName,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    }
  }

  async getMultiplePackageVersions(
    packages: Record<string, PackageVersionConfig>
  ): Promise<Record<string, PackageVersionInfo>> {
    const results: Record<string, PackageVersionInfo> = {};

    const promises = Object.entries(packages).map(async ([name, config]) => {
      try {
        const info = await this.getPackageVersion(name, config);
        results[name] = info;
      } catch (error) {
        logger.error(`Failed to get version for ${name}: ${error}`);

        if (config.fallbackVersion) {
          results[name] = {
            name,
            version: config.fallbackVersion,
            strategy: config.strategy,
            isLatest: false,
          };
        } else {
          throw error;
        }
      }
    });

    await Promise.all(promises);
    return results;
  }

  formatPackagesForInstall(
    packages: Record<string, PackageVersionInfo>
  ): string[] {
    return Object.entries(packages).map(([name, info]) => {
      if (info.version === 'latest') {
        return name;
      }

      return `${name}@${info.version}`;
    });
  }

  private getCachedVersion(packageName: string): string | null {
    const cached = PackageVersionService.VERSION_CACHE.get(packageName);
    if (
      cached &&
      Date.now() - cached.timestamp < PackageVersionService.CACHE_TTL
    ) {
      return cached.version;
    }
    return null;
  }

  private setCachedVersion(packageName: string, version: string): void {
    PackageVersionService.VERSION_CACHE.set(packageName, {
      version,
      timestamp: Date.now(),
    });
  }

  static clearCache(): void {
    PackageVersionService.VERSION_CACHE.clear();
  }
}
