import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrettierModule } from '../../../src/modules/prettier';
import type { InstallOptions } from '../../../src/modules/base.module';
import { SimpleLogicError } from '../../../src/errors/logic.error';
import { FileNotFoundError } from '../../../src/errors/logic/file.error';

vi.mock('../../../src/utils/file', () => ({
  fileExists: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('../../../src/modules/prettier/builder', () => ({
  PrettierConfigBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn().mockResolvedValue({
      config: '{"semi": true, "singleQuote": true}',
      configFileName: '.prettierrc.json',
      presetName: 'Standard'
    }),
  })),
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    spinner: vi.fn(() => ({
      text: '',
      succeed: vi.fn(),
      fail: vi.fn(),
    })),
    debug: vi.fn(),
  },
}));

describe('PrettierModule', () => {
  let module: PrettierModule;
  let fileExistsMock: any;
  let readFileMock: any;
  let unlinkMock: any;

  beforeEach(async () => {
    module = new PrettierModule();
    const fileUtils = await import('../../../src/utils/file');
    fileExistsMock = vi.mocked(fileUtils.fileExists);
    
    const fsPromises = await import('fs/promises');
    readFileMock = vi.mocked(fsPromises.readFile);
    unlinkMock = vi.mocked(fsPromises.unlink);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isInstalled', () => {
    it('should return true when .prettierrc exists', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc');
      });

      const result = await module.isInstalled('/test/project');
      expect(result).toBe(true);
    });

    it('should return true when prettier config in package.json', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('package.json');
      });
      readFileMock.mockResolvedValue('{"prettier": {"semi": false}}');

      const result = await module.isInstalled('/test/project');
      expect(result).toBe(true);
    });

    it('should return false when no prettier config exists', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await module.isInstalled('/test/project');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      fileExistsMock.mockRejectedValue(new Error('File error'));

      const result = await module.isInstalled('/test/project');
      expect(result).toBe(false);
    });
  });

  describe('validate', () => {
    const defaultOptions: InstallOptions = {
      projectPath: '/test/project',
      projectType: 'node',
      hasTypeScript: false,
      packageManager: 'npm',
      verbose: false,
      dryRun: false,
      force: false,
      packageJson: {},
    };

    it('should pass validation when prettier not installed', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await module.validate(defaultOptions);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when prettier already installed', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc');
      });

      const result = await module.validate(defaultOptions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Prettier configuration already exists. Use --force to overwrite.'
      );
    });

    it('should pass validation with warning when using force', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc');
      });

      const result = await module.validate({ ...defaultOptions, force: true });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain(
        'Existing Prettier configuration will be overwritten'
      );
    });
  });

  describe('getDependencies', () => {
    it('should return prettier as dev dependency', async () => {
      const deps = await module.getDependencies();

      expect(deps.devDependencies).toBeDefined();
      expect(deps.devDependencies?.prettier).toBeDefined();
      expect(deps.dependencies).toBeUndefined();
    });
  });

  describe('getFilesToCreate', () => {
    const defaultOptions: InstallOptions = {
      projectPath: '/test/project',
      projectType: 'node',
      hasTypeScript: false,
      packageManager: 'npm',
      verbose: false,
      dryRun: false,
      force: false,
      packageJson: {},
    };

    it('should create prettierrc and prettierignore files', async () => {
      const files = await module.getFilesToCreate(defaultOptions);

      expect(files.has('.prettierrc.json')).toBe(true);
      expect(files.has('.prettierignore')).toBe(true);
    });

    it('should use default config in dry run mode', async () => {
      const files = await module.getFilesToCreate({ ...defaultOptions, dryRun: true });

      const config = files.get('.prettierrc.json');
      expect(config).toBeDefined();
      expect(config).toContain('"semi": true');
      expect(config).toContain('"singleQuote": true');
    });

    it('should add jsx config for React projects', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions, 
        projectType: 'react',
        dryRun: true 
      });

      const config = files.get('.prettierrc.json');
      expect(config).toContain('"jsxSingleQuote": true');
    });

    it('should add TypeScript parser when hasTypeScript', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions, 
        hasTypeScript: true,
        dryRun: true 
      });

      const config = files.get('.prettierrc.json');
      expect(config).toContain('"parser": "typescript"');
    });

    it('should add framework-specific ignore patterns', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions, 
        projectType: 'next' 
      });

      const ignoreFile = files.get('.prettierignore');
      expect(ignoreFile).toContain('.next/');
      expect(ignoreFile).toContain('next-env.d.ts');
    });
  });

  describe('uninstall', () => {
    const defaultOptions: InstallOptions = {
      projectPath: '/test/project',
      projectType: 'node',
      hasTypeScript: false,
      packageManager: 'npm',
      verbose: false,
      dryRun: false,
      force: false,
      packageJson: {},
    };

    it('should remove prettier config files', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc.json') || path.endsWith('.prettierignore');
      });
      unlinkMock.mockResolvedValue(undefined);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(true);
      expect(unlinkMock).toHaveBeenCalledWith('/test/project/.prettierrc.json');
      expect(unlinkMock).toHaveBeenCalledWith('/test/project/.prettierignore');
    });

    it('should throw error when no config files found', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toBeInstanceOf(FileNotFoundError);
    });

    it('should handle permission errors', async () => {
      fileExistsMock.mockImplementation(async (path: string) => {
        return path.endsWith('.prettierrc.json');
      });
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      unlinkMock.mockRejectedValue(error);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toBeInstanceOf(SimpleLogicError);
    });
  });
});