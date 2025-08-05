import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigDetector } from '../../../src/core/config-detector';
import { ModuleRegistry } from '../../../src/modules';
import { ConfigNotFoundError, ConfigReadError, ProjectNotValidError } from '../../../src/errors/logic/config.error';
import type { DetectedConfig } from '../../../src/types/config.type';

vi.mock('../../../src/utils/file', () => ({
  fileExists: vi.fn(),
}));

vi.mock('../../../src/modules', () => ({
  ModuleRegistry: {
    get: vi.fn(),
    getAll: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ConfigDetector', () => {
  let fileExistsMock: any;
  let ModuleRegistryMock: any;

  beforeEach(async () => {
    const fileUtils = await import('../../../src/utils/file');
    fileExistsMock = vi.mocked(fileUtils.fileExists);
    ModuleRegistryMock = vi.mocked(ModuleRegistry);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectInstalledConfigs', () => {
    it('should detect configs from both module registry and patterns', async () => {
      // Mock valid project
      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === '/test/project' || path.endsWith('package.json')) return true;
        if (path.endsWith('.prettierrc')) return true;
        if (path.endsWith('tsconfig.json')) return true;
        return false;
      });

      // Mock module registry
      ModuleRegistryMock.getAll.mockReturnValue([
        {
          name: 'prettier',
          version: '1.0.0',
          isInstalled: vi.fn().mockResolvedValue(true),
        },
      ]);

      const result = await ConfigDetector.detectInstalledConfigs('/test/project');

      expect(result).toHaveLength(2); // prettier and typescript
      expect(result.find(c => c.name === 'prettier')).toBeDefined();
      expect(result.find(c => c.name === 'typescript')).toBeDefined();
    });

    it('should throw ProjectNotValidError for invalid project path', async () => {
      fileExistsMock.mockResolvedValue(false);

      await expect(ConfigDetector.detectInstalledConfigs('/invalid/path')).rejects.toThrow(ProjectNotValidError);
    });

    it('should throw ProjectNotValidError when no package.json', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path === '/test/project';
      });

      await expect(ConfigDetector.detectInstalledConfigs('/test/project')).rejects.toThrow(ProjectNotValidError);
    });

    it('should handle module registry errors gracefully', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === '/test/project' || path.endsWith('package.json')) return true;
        return false;
      });

      ModuleRegistryMock.getAll.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await ConfigDetector.detectInstalledConfigs('/test/project');

      expect(result).toEqual([]);
    });

    it('should detect husky from directory', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        if (path === '/test/project' || path.endsWith('package.json')) return true;
        if (path.endsWith('.husky')) return true;
        return false;
      });

      ModuleRegistryMock.getAll.mockReturnValue([]);

      const result = await ConfigDetector.detectInstalledConfigs('/test/project');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('husky');
    });
  });

  describe('isConfigInstalled', () => {
    it('should return true when module is installed', async () => {
      const mockModule = {
        isInstalled: vi.fn().mockResolvedValue(true),
      };
      ModuleRegistryMock.get.mockReturnValue(mockModule);

      const result = await ConfigDetector.isConfigInstalled('/test/project', 'prettier');

      expect(result).toBe(true);
      expect(mockModule.isInstalled).toHaveBeenCalledWith('/test/project');
    });

    it('should check pattern when module not found', async () => {
      ModuleRegistryMock.get.mockReturnValue(null);
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc');
      });

      const result = await ConfigDetector.isConfigInstalled('/test/project', 'prettier');

      expect(result).toBe(true);
    });

    it('should throw ConfigNotFoundError for unknown config', async () => {
      ModuleRegistryMock.get.mockReturnValue(null);

      await expect(ConfigDetector.isConfigInstalled('/test/project', 'unknown-config')).rejects.toThrow(ConfigNotFoundError);
    });

    it('should return false when config not installed', async () => {
      ModuleRegistryMock.get.mockReturnValue(null);
      fileExistsMock.mockResolvedValue(false);

      const result = await ConfigDetector.isConfigInstalled('/test/project', 'eslint');

      expect(result).toBe(false);
    });
  });

  describe('findConfigFile', () => {
    it('should find first matching config file', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc.json');
      });

      const result = await ConfigDetector.findConfigFile('/test/project', 'prettier');

      expect(result).toBe('/test/project/.prettierrc.json');
    });

    it('should return null when no config file found', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await ConfigDetector.findConfigFile('/test/project', 'prettier');

      expect(result).toBeNull();
    });

    it('should return null for unknown config', async () => {
      const result = await ConfigDetector.findConfigFile('/test/project', 'unknown-config');

      expect(result).toBeNull();
    });

    it('should return null for config without files', async () => {
      const result = await ConfigDetector.findConfigFile('/test/project', 'husky');

      expect(result).toBeNull();
    });

    it('should throw ConfigReadError on file system error', async () => {
      fileExistsMock.mockRejectedValue(new Error('FS error'));

      await expect(ConfigDetector.findConfigFile('/test/project', 'prettier')).rejects.toThrow(ConfigReadError);
    });
  });

  describe('categorizeConfigs', () => {
    it('should categorize configs correctly', () => {
      const configs: DetectedConfig[] = [
        { name: 'eslint', detectedFiles: [] },
        { name: 'prettier', detectedFiles: [] },
        { name: 'typescript', detectedFiles: [] },
        { name: 'vitest', detectedFiles: [] },
        { name: 'husky', detectedFiles: [] },
        { name: 'editorconfig', detectedFiles: [] },
        { name: 'custom-tool', detectedFiles: [] },
      ];

      const result = ConfigDetector.categorizeConfigs(configs);

      expect(result.linting).toEqual(['eslint', 'prettier']);
      expect(result.testing).toEqual(['vitest']);
      expect(result.building).toEqual(['typescript']);
      expect(result.git).toEqual(['husky']);
      expect(result.editor).toEqual(['editorconfig']);
      expect(result.other).toEqual(['custom-tool']);
    });

    it('should handle empty configs', () => {
      const result = ConfigDetector.categorizeConfigs([]);

      expect(result.linting).toEqual([]);
      expect(result.testing).toEqual([]);
      expect(result.building).toEqual([]);
      expect(result.git).toEqual([]);
      expect(result.editor).toEqual([]);
      expect(result.other).toEqual([]);
    });
  });
});