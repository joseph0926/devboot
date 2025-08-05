import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectAnalyzer } from '../../../src/core/project-analyzer';
import { SimpleLogicError } from '../../../src/errors/logic.error';
import { ProjectInvalidError } from '../../../src/errors/logic/project.error';
import type { PackageJson } from '../../../src/types/file.type';

vi.mock('../../../src/utils/file', () => ({
  readPackageJson: vi.fn(),
  fileExists: vi.fn(),
}));

describe('ProjectAnalyzer', () => {
  let analyzer: ProjectAnalyzer;
  let readPackageJsonMock: any;
  let fileExistsMock: any;

  beforeEach(async () => {
    analyzer = new ProjectAnalyzer();
    const fileUtils = await import('../../../src/utils/file');
    readPackageJsonMock = vi.mocked(fileUtils.readPackageJson);
    fileExistsMock = vi.mocked(fileUtils.fileExists);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze', () => {
    const testProjectPath = '/test/project';

    it('should analyze a Next.js project', async () => {
      const packageJson: PackageJson = {
        name: 'test-next-app',
        version: '1.0.0',
        dependencies: {
          next: '^13.0.0',
          react: '^18.0.0',
        },
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('pnpm-lock.yaml')) return true;
        if (path.endsWith('tsconfig.json')) return true;
        if (path.endsWith('src')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.name).toBe('test-next-app');
      expect(result.version).toBe('1.0.0');
      expect(result.projectType).toBe('next');
      expect(result.packageManager).toBe('pnpm');
      expect(result.hasTypeScript).toBe(true);
      expect(result.hasSrcDirectory).toBe(true);
    });

    it('should analyze a Vite React project', async () => {
      const packageJson: PackageJson = {
        name: 'vite-app',
        version: '0.1.0',
        devDependencies: {
          vite: '^4.0.0',
          react: '^18.0.0',
        },
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('yarn.lock')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.projectType).toBe('vite');
      expect(result.packageManager).toBe('yarn');
      expect(result.hasTypeScript).toBe(false);
    });

    it('should analyze a plain React project', async () => {
      const packageJson: PackageJson = {
        name: 'react-app',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0',
        },
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('package-lock.json')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.projectType).toBe('react');
      expect(result.packageManager).toBe('npm');
    });

    it('should analyze a Node.js project', async () => {
      const packageJson: PackageJson = {
        name: 'node-lib',
        version: '2.0.0',
        dependencies: {
          express: '^4.0.0',
        },
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('bun.lockb')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.projectType).toBe('node');
      expect(result.packageManager).toBe('bun');
    });

    it('should detect package manager from packageManager field', async () => {
      const packageJson: PackageJson = {
        name: 'test-app',
        packageManager: 'pnpm@8.0.0',
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        return path === testProjectPath;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.packageManager).toBe('pnpm');
    });

    it('should detect test directories', async () => {
      const packageJson: PackageJson = {
        name: 'test-app',
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('__tests__')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.hasTestDirectory).toBe(true);
    });

    it('should handle missing project name and version', async () => {
      const packageJson: PackageJson = {};

      fileExistsMock.mockResolvedValue(true);
      readPackageJsonMock.mockResolvedValue(packageJson);

      const result = await analyzer.analyze(testProjectPath);

      expect(result.name).toBe('unnamed-project');
      expect(result.version).toBe('0.0.0');
    });

    it('should throw error if project path does not exist', async () => {
      fileExistsMock.mockResolvedValue(false);

      await expect(analyzer.analyze(testProjectPath)).rejects.toThrow(SimpleLogicError);
      await expect(analyzer.analyze(testProjectPath)).rejects.toThrow(
        'Project path does not exist'
      );
    });

    it('should throw ProjectInvalidError if package.json cannot be read', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('package.json')) return true;
        return false;
      });

      readPackageJsonMock.mockRejectedValue(new Error('Invalid JSON'));

      await expect(analyzer.analyze(testProjectPath)).rejects.toThrow(ProjectInvalidError);
    });

    it('should detect TypeScript from src directory files', async () => {
      const packageJson: PackageJson = {
        name: 'ts-app',
      };

      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === testProjectPath) return true;
        if (path.endsWith('src')) return true;
        return false;
      });

      readPackageJsonMock.mockResolvedValue(packageJson);

      vi.mock('fs/promises', () => ({
        readdir: vi.fn().mockResolvedValue(['index.ts', 'app.tsx', 'config.js']),
      }));

      const result = await analyzer.analyze(testProjectPath);

      expect(result.hasTypeScript).toBe(true);
    });
  });
});