import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import type { Ora } from 'ora';
import { SimpleLogicError } from '../errors/logic.error.js';
import { LogicErrorCodes } from '../types/error.type.js';
import { BaseError } from '../errors/base.error.js';
import {
  PackageInstallError,
  PackageManagerExecutionError,
  PackageManagerNotFoundError,
} from '../errors/logic/package.error.js';
import { isNodeError, isNetworkError, ExecError } from '../types/error.type.js';
import { ErrorLogger } from '../utils/error-logger.js';
import * as readline from 'readline';

const execAsync = promisify(exec);

export interface Dependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PackageManagerOptions {
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  projectPath: string;
  verbose?: boolean;
  confirmInstall?: boolean;
  skipConfirmation?: boolean;
}

export interface PackageInstallResult {
  success: boolean;
  installed: string[];
  error?: BaseError;
}

export class PackageManagerService {
  async install(
    deps: Dependencies,
    options: PackageManagerOptions
  ): Promise<PackageInstallResult> {
    const packages = this.formatPackages(deps);

    if (packages.prod.length === 0 && packages.dev.length === 0) {
      return { success: true, installed: [] };
    }

    if (options.confirmInstall && !options.skipConfirmation) {
      const shouldInstall = await this.promptForConfirmation(packages);
      if (!shouldInstall) {
        logger.info('❌ Package installation cancelled by user');
        return {
          success: false,
          installed: [],
          error: new SimpleLogicError(
            LogicErrorCodes.USER_CANCELLED,
            'Package installation cancelled by user',
            false
          ),
        };
      }
    }

    const totalPackages = packages.prod.length + packages.dev.length;
    const spinner = logger.spinner(
      `📦 Installing ${totalPackages} package${totalPackages > 1 ? 's' : ''}...`
    );

    try {
      const installed: string[] = [];

      if (packages.prod.length > 0) {
        await this.runInstallCommand(packages.prod, false, options, spinner);
        installed.push(...packages.prod);
      }

      if (packages.dev.length > 0) {
        await this.runInstallCommand(packages.dev, true, options, spinner);
        installed.push(...packages.dev);
      }

      const installedCount = installed.length;
      spinner.succeed(
        `✅ Successfully installed ${installedCount} package${installedCount > 1 ? 's' : ''}`
      );

      if (installedCount > 0) {
        logger.info('\n🎉 Installation complete!');
        logger.info('📋 Installed packages:');

        const prodPackages = packages.prod.filter((pkg) =>
          installed.includes(pkg)
        );
        const devPackages = packages.dev.filter((pkg) =>
          installed.includes(pkg)
        );

        if (prodPackages.length > 0) {
          logger.info('\n  📦 Dependencies:');
          prodPackages.forEach((pkg) => {
            const [name, version] = pkg.split('@');
            logger.info(`   ✅ ${name}${version ? ` (v${version})` : ''}`);
          });
        }

        if (devPackages.length > 0) {
          logger.info('\n  🛠️  Dev Dependencies:');
          devPackages.forEach((pkg) => {
            const [name, version] = pkg.split('@');
            logger.info(`   ✅ ${name}${version ? ` (v${version})` : ''}`);
          });
        }

        logger.info("\n🚀 You're all set! Happy coding!");
      }
      return { success: true, installed };
    } catch (error) {
      spinner.fail('❌ Failed to install packages');

      if (error instanceof BaseError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new PackageInstallError(
        `Failed to install packages: ${errorMessage}`,
        {
          packages: [...packages.prod, ...packages.dev],
          packageManager: options.packageManager,
          originalError: errorMessage,
        },
        error
      );
    }
  }

  private formatPackages(deps: Dependencies): {
    prod: string[];
    dev: string[];
  } {
    const prod = Object.entries(deps.dependencies || {}).map(
      ([name, version]) => `${name}@${version}`
    );
    const dev = Object.entries(deps.devDependencies || {}).map(
      ([name, version]) => `${name}@${version}`
    );

    return { prod, dev };
  }

  private async runInstallCommand(
    packages: string[],
    isDev: boolean,
    options: PackageManagerOptions,
    spinner: Ora
  ): Promise<void> {
    const command = this.buildInstallCommand(
      packages,
      isDev,
      options.packageManager
    );

    const packageType = isDev ? 'dev dependencies' : 'dependencies';
    const packageNames = packages.map((p) => p.split('@')[0]).join(', ');
    spinner.text = `📥 Installing ${packageType}: ${packageNames}`;

    if (options.verbose) {
      logger.debug(`Running: ${command}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: options.projectPath,
      });

      if (options.verbose && stdout) {
        logger.debug(stdout);
      }

      if (stderr && !stderr.includes('warning')) {
        throw new PackageManagerExecutionError(
          `Package manager reported errors: ${stderr}`,
          {
            command,
            stderr,
            packageManager: options.packageManager,
            packages,
          }
        );
      }
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      if (isNodeError(error)) {
        if (error.code === 'ENOENT') {
          throw new PackageManagerNotFoundError(
            `⚠️ ${options.packageManager} is not installed\n🔧 Please install ${options.packageManager} first: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm`,
            {
              packageManager: options.packageManager,
              errorCode: error.code,
            }
          );
        }

        if (error.code === 'EACCES' || error.code === 'EPERM') {
          throw new SimpleLogicError(
            LogicErrorCodes.PERMISSION_DENIED,
            '🔒 Permission denied while installing packages',
            false,
            {
              command,
              errorCode: error.code,
              packages,
            },
            '💡 Try: sudo npm install or fix npm permissions (see: npm docs permissions)'
          );
        }

        if (isNetworkError(error)) {
          throw new SimpleLogicError(
            LogicErrorCodes.NETWORK_ERROR,
            '🌐 Network error while installing packages',
            true,
            {
              command,
              errorCode: error.code,
              packages,
            },
            '🔄 Check your internet connection, proxy settings, and try again'
          );
        }
      }

      const execError = error as ExecError;
      if (execError.stderr) {
        if (execError.stderr.includes('E404')) {
          throw new PackageInstallError(
            `❌ Package not found\n🔍 Please check the package name and try again`,
            {
              packages,
              packageManager: options.packageManager,
              stderr: execError.stderr,
            }
          );
        }

        if (
          execError.stderr.includes('EACCES') ||
          execError.stderr.includes('permission')
        ) {
          throw new PackageInstallError(
            '🔒 Permission denied. Try running with elevated privileges or check npm config',
            {
              packages,
              packageManager: options.packageManager,
              stderr: execError.stderr,
            }
          );
        }

        if (
          execError.stderr.includes('ECONNREFUSED') ||
          execError.stderr.includes('network')
        ) {
          throw new PackageInstallError(
            '🌐 Network error. Please check your internet connection and proxy settings',
            {
              packages,
              packageManager: options.packageManager,
              stderr: execError.stderr,
            }
          );
        }
      }

      throw error;
    }
  }

  private buildInstallCommand(
    packages: string[],
    isDev: boolean,
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  ): string {
    const packageList = packages.join(' ');

    switch (packageManager) {
      case 'npm':
        return `npm install ${isDev ? '--save-dev' : '--save'} ${packageList}`;
      case 'pnpm':
        return `pnpm add ${isDev ? '-D' : ''} ${packageList}`;
      case 'yarn':
        return `yarn add ${isDev ? '-D' : ''} ${packageList}`;
      case 'bun':
        return `bun add ${isDev ? '-d' : ''} ${packageList}`;
      default:
        throw new SimpleLogicError(
          LogicErrorCodes.INVALID_PACKAGE_MANAGER,
          `Unsupported package manager: ${packageManager}`,
          false,
          { packageManager },
          'Supported package managers: npm, pnpm, yarn, bun'
        );
    }
  }

  async uninstall(
    packages: string[],
    options: PackageManagerOptions
  ): Promise<{ success: boolean; error?: Error }> {
    if (packages.length === 0) {
      return { success: true };
    }

    const command = this.buildUninstallCommand(
      packages,
      options.packageManager
    );
    const spinner = logger.spinner('Uninstalling packages...');

    try {
      if (options.verbose) {
        logger.debug(`Running: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: options.projectPath,
      });

      if (options.verbose && stdout) {
        logger.debug(stdout);
      }

      if (stderr && !stderr.includes('warning')) {
        ErrorLogger.logWarning(`Uninstall warnings: ${stderr}`);
      }

      spinner.succeed('✅ Packages uninstalled successfully');
      return { success: true };
    } catch (error) {
      spinner.fail('❌ Failed to uninstall packages');

      if (isNodeError(error)) {
        if (error.code === 'ENOENT') {
          throw new PackageManagerNotFoundError(
            `⚠️ ${options.packageManager} is not installed\n🔧 Please install ${options.packageManager} first: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm`,
            {
              packageManager: options.packageManager,
              errorCode: error.code,
            }
          );
        }

        if (error.code === 'EACCES' || error.code === 'EPERM') {
          throw new SimpleLogicError(
            LogicErrorCodes.PERMISSION_DENIED,
            'Permission denied while uninstalling packages',
            false,
            {
              command,
              errorCode: error.code,
              packages,
            },
            'Try running with sudo or check permissions'
          );
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      throw new SimpleLogicError(
        LogicErrorCodes.PKG_UNINSTALL_FAILED,
        `Failed to uninstall packages: ${errorMessage}`,
        true,
        {
          command,
          packages,
          errorMessage,
          packageManager: options.packageManager,
        },
        'Check if packages are installed and try again'
      );
    }
  }

  private buildUninstallCommand(
    packages: string[],
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  ): string {
    const packageList = packages.join(' ');

    switch (packageManager) {
      case 'npm':
        return `npm uninstall ${packageList}`;
      case 'pnpm':
        return `pnpm remove ${packageList}`;
      case 'yarn':
        return `yarn remove ${packageList}`;
      case 'bun':
        return `bun remove ${packageList}`;
      default:
        throw new SimpleLogicError(
          LogicErrorCodes.INVALID_PACKAGE_MANAGER,
          `Unsupported package manager: ${packageManager}`,
          false,
          { packageManager },
          'Supported package managers: npm, pnpm, yarn, bun'
        );
    }
  }

  private async promptForConfirmation(packages: {
    prod: string[];
    dev: string[];
  }): Promise<boolean> {
    logger.info('\n📦 The following packages will be installed:\n');

    if (packages.prod.length > 0) {
      logger.info('📋 Dependencies:');
      packages.prod.forEach((pkg) => {
        const [name, version] = pkg.split('@');
        logger.info(`   • ${name}${version ? ` (v${version})` : ''}`);
      });
    }

    if (packages.dev.length > 0) {
      logger.info('\n🛠️  Dev Dependencies:');
      packages.dev.forEach((pkg) => {
        const [name, version] = pkg.split('@');
        logger.info(`   • ${name}${version ? ` (v${version})` : ''}`);
      });
    }

    const totalSize = packages.prod.length + packages.dev.length;
    logger.info(
      `\n📊 Total: ${totalSize} package${totalSize > 1 ? 's' : ''}\n`
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question('🤔 Do you want to continue? [y/N]: ', (answer) => {
        rl.close();
        const shouldContinue =
          answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
        if (shouldContinue) {
          logger.info('🚀 Starting installation...\n');
        } else {
          logger.info('❌ Installation cancelled by user');
        }
        resolve(shouldContinue);
      });
    });
  }

  getManualInstallCommand(
    deps: Dependencies,
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  ): string[] {
    const commands: string[] = [];
    const packages = this.formatPackages(deps);

    if (packages.prod.length > 0) {
      const prodList = packages.prod.join(' ');
      switch (packageManager) {
        case 'npm':
          commands.push(`npm install --save ${prodList}`);
          break;
        case 'pnpm':
          commands.push(`pnpm add ${prodList}`);
          break;
        case 'yarn':
          commands.push(`yarn add ${prodList}`);
          break;
        case 'bun':
          commands.push(`bun add ${prodList}`);
          break;
      }
    }

    if (packages.dev.length > 0) {
      const devList = packages.dev.join(' ');
      switch (packageManager) {
        case 'npm':
          commands.push(`npm install --save-dev ${devList}`);
          break;
        case 'pnpm':
          commands.push(`pnpm add -D ${devList}`);
          break;
        case 'yarn':
          commands.push(`yarn add -D ${devList}`);
          break;
        case 'bun':
          commands.push(`bun add -d ${devList}`);
          break;
      }
    }

    return commands;
  }
}
