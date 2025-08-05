import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PackageManagerService } from '../../../src/core/package-manager';
import type { Dependencies, PackageManagerOptions } from '../../../src/core/package-manager';
import { PackageInstallError, PackageManagerNotFoundError } from '../../../src/errors/logic/package.error';
import { SimpleLogicError } from '../../../src/errors/logic.error';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    spinner: vi.fn(() => ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
    })),
    debug: vi.fn(),
  },
}));

describe('PackageManagerService', () => {
  let service: PackageManagerService;
  let execMock: any;

  beforeEach(async () => {
    service = new PackageManagerService();
    const childProcess = await import('child_process');
    execMock = vi.mocked(childProcess.exec);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('install', () => {
    const defaultOptions: PackageManagerOptions = {
      packageManager: 'npm',
      projectPath: '/test/project',
      verbose: false,
    };

    it('should install production dependencies', async () => {
      const deps: Dependencies = {
        dependencies: {
          'chalk': '^5.0.0',
          'commander': '^9.0.0',
        },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'installed', stderr: '' });
      });

      const result = await service.install(deps, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.installed).toContain('chalk@^5.0.0');
      expect(result.installed).toContain('commander@^9.0.0');
      expect(execMock).toHaveBeenCalledWith(
        'npm install --save chalk@^5.0.0 commander@^9.0.0',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should install dev dependencies', async () => {
      const deps: Dependencies = {
        devDependencies: {
          'vitest': '^1.0.0',
          'typescript': '^5.0.0',
        },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'installed', stderr: '' });
      });

      const result = await service.install(deps, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.installed).toContain('vitest@^1.0.0');
      expect(result.installed).toContain('typescript@^5.0.0');
      expect(execMock).toHaveBeenCalledWith(
        'npm install --save-dev vitest@^1.0.0 typescript@^5.0.0',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should handle pnpm package manager', async () => {
      const deps: Dependencies = {
        dependencies: { 'chalk': '^5.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'installed', stderr: '' });
      });

      await service.install(deps, { ...defaultOptions, packageManager: 'pnpm' });

      expect(execMock).toHaveBeenCalledWith(
        'pnpm add  chalk@^5.0.0',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should handle yarn package manager', async () => {
      const deps: Dependencies = {
        devDependencies: { 'vitest': '^1.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'installed', stderr: '' });
      });

      await service.install(deps, { ...defaultOptions, packageManager: 'yarn' });

      expect(execMock).toHaveBeenCalledWith(
        'yarn add -D vitest@^1.0.0',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should handle bun package manager', async () => {
      const deps: Dependencies = {
        dependencies: { 'chalk': '^5.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'installed', stderr: '' });
      });

      await service.install(deps, { ...defaultOptions, packageManager: 'bun' });

      expect(execMock).toHaveBeenCalledWith(
        'bun add  chalk@^5.0.0',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should return success with empty array when no packages to install', async () => {
      const deps: Dependencies = {};

      const result = await service.install(deps, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.installed).toEqual([]);
      expect(execMock).not.toHaveBeenCalled();
    });

    it('should throw PackageManagerNotFoundError when package manager not found', async () => {
      const deps: Dependencies = {
        dependencies: { 'chalk': '^5.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        const error = new Error('Command not found');
        (error as any).code = 'ENOENT';
        callback(error);
      });

      await expect(service.install(deps, defaultOptions)).rejects.toThrow(PackageManagerNotFoundError);
    });

    it('should throw PackageInstallError when package not found (E404)', async () => {
      const deps: Dependencies = {
        dependencies: { 'non-existent-package': '^1.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        const error = new Error('Not found');
        (error as any).stderr = 'E404 Not found';
        callback(error);
      });

      await expect(service.install(deps, defaultOptions)).rejects.toThrow(PackageInstallError);
    });

    it('should throw SimpleLogicError for permission errors', async () => {
      const deps: Dependencies = {
        dependencies: { 'chalk': '^5.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        const error = new Error('Permission denied');
        (error as any).code = 'EACCES';
        callback(error);
      });

      await expect(service.install(deps, defaultOptions)).rejects.toThrow(SimpleLogicError);
    });

    it('should throw SimpleLogicError for network errors', async () => {
      const deps: Dependencies = {
        dependencies: { 'chalk': '^5.0.0' },
      };

      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        const error = new Error('Network error');
        (error as any).code = 'ENOTFOUND';
        callback(error);
      });

      await expect(service.install(deps, defaultOptions)).rejects.toThrow(SimpleLogicError);
    });
  });

  describe('uninstall', () => {
    const defaultOptions: PackageManagerOptions = {
      packageManager: 'npm',
      projectPath: '/test/project',
      verbose: false,
    };

    it('should uninstall packages successfully', async () => {
      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'uninstalled', stderr: '' });
      });

      const result = await service.uninstall(['chalk', 'commander'], defaultOptions);

      expect(result.success).toBe(true);
      expect(execMock).toHaveBeenCalledWith(
        'npm uninstall chalk commander',
        { cwd: '/test/project' },
        expect.any(Function)
      );
    });

    it('should handle different package managers for uninstall', async () => {
      execMock.mockImplementation((_cmd: string, _opts: any, callback: any) => {
        callback(null, { stdout: 'uninstalled', stderr: '' });
      });

      await service.uninstall(['chalk'], { ...defaultOptions, packageManager: 'pnpm' });
      expect(execMock).toHaveBeenCalledWith(
        'pnpm remove chalk',
        expect.any(Object),
        expect.any(Function)
      );

      await service.uninstall(['chalk'], { ...defaultOptions, packageManager: 'yarn' });
      expect(execMock).toHaveBeenCalledWith(
        'yarn remove chalk',
        expect.any(Object),
        expect.any(Function)
      );

      await service.uninstall(['chalk'], { ...defaultOptions, packageManager: 'bun' });
      expect(execMock).toHaveBeenCalledWith(
        'bun remove chalk',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should return success when no packages to uninstall', async () => {
      const result = await service.uninstall([], defaultOptions);

      expect(result.success).toBe(true);
      expect(execMock).not.toHaveBeenCalled();
    });

    it('should throw error for unsupported package manager', async () => {
      const invalidOptions = {
        ...defaultOptions,
        packageManager: 'invalid' as any,
      };

      await expect(service.uninstall(['chalk'], invalidOptions)).rejects.toThrow(SimpleLogicError);
    });
  });
});