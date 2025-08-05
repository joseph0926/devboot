import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorConfigModule } from '../../../src/modules/editorconfig';
import type { InstallOptions } from '../../../src/modules/base.module';
import { SimpleLogicError } from '../../../src/errors/logic.error';
import { FileNotFoundError } from '../../../src/errors/logic/file.error';

vi.mock('../../../src/utils/file', () => ({
  fileExists: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  unlink: vi.fn(),
}));

vi.mock('../../../src/modules/editorconfig/builder', () => ({
  EditorConfigBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn().mockResolvedValue('# Generated EditorConfig\nroot = true\n'),
  })),
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe('EditorConfigModule', () => {
  let module: EditorConfigModule;
  let fileExistsMock: any;
  let unlinkMock: any;

  beforeEach(async () => {
    module = new EditorConfigModule();
    const fileUtils = await import('../../../src/utils/file');
    fileExistsMock = vi.mocked(fileUtils.fileExists);
    
    const fsPromises = await import('fs/promises');
    unlinkMock = vi.mocked(fsPromises.unlink);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isInstalled', () => {
    it('should return true when .editorconfig exists', async () => {
      fileExistsMock.mockResolvedValue(true);

      const result = await module.isInstalled('/test/project');
      
      expect(result).toBe(true);
      expect(fileExistsMock).toHaveBeenCalledWith('/test/project/.editorconfig');
    });

    it('should return false when .editorconfig does not exist', async () => {
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

    it('should pass validation when editorconfig not installed', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await module.validate(defaultOptions);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when editorconfig already installed', async () => {
      fileExistsMock.mockResolvedValue(true);

      const result = await module.validate(defaultOptions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        '.editorconfig already exists. Use --force to overwrite.'
      );
    });

    it('should pass validation with warning when using force', async () => {
      fileExistsMock.mockResolvedValue(true);

      const result = await module.validate({ ...defaultOptions, force: true });

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Existing .editorconfig will be overwritten');
    });
  });

  describe('getDependencies', () => {
    it('should return empty dependencies', async () => {
      const deps = await module.getDependencies();

      expect(deps).toEqual({});
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

    it('should create .editorconfig file', async () => {
      const files = await module.getFilesToCreate(defaultOptions);

      expect(files.has('.editorconfig')).toBe(true);
      expect(files.get('.editorconfig')).toContain('# Generated EditorConfig');
    });

    it('should use default config in dry run mode', async () => {
      const files = await module.getFilesToCreate({ ...defaultOptions, dryRun: true });

      const content = files.get('.editorconfig');
      expect(content).toBeDefined();
      expect(content).toContain('root = true');
      expect(content).toContain('charset = utf-8');
      expect(content).toContain('indent_style = space');
    });

    it('should include TypeScript config when hasTypeScript', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions, 
        hasTypeScript: true,
        dryRun: true 
      });

      const content = files.get('.editorconfig');
      expect(content).toContain('[*.{ts,tsx}]');
    });

    it('should respect prettier config for indentation', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions,
        dryRun: true,
        packageJson: {
          prettier: {
            tabWidth: 4,
            useTabs: true,
          },
        },
      });

      const content = files.get('.editorconfig');
      expect(content).toContain('indent_size = 4');
      expect(content).toContain('indent_style = tab');
    });

    it('should include framework-specific patterns', async () => {
      const files = await module.getFilesToCreate({ 
        ...defaultOptions,
        projectType: 'react',
        dryRun: true 
      });

      const content = files.get('.editorconfig');
      expect(content).toContain('[*.{js,jsx,mjs,cjs}]');
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

    it('should remove .editorconfig file', async () => {
      fileExistsMock.mockResolvedValue(true);
      unlinkMock.mockResolvedValue(undefined);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(true);
      expect(unlinkMock).toHaveBeenCalledWith('/test/project/.editorconfig');
    });

    it('should throw error when .editorconfig not found', async () => {
      fileExistsMock.mockResolvedValue(false);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toBeInstanceOf(FileNotFoundError);
    });

    it('should handle permission errors', async () => {
      fileExistsMock.mockResolvedValue(true);
      const error = new Error('Permission denied');
      (error as any).code = 'EACCES';
      unlinkMock.mockRejectedValue(error);

      const result = await module.uninstall(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toBeInstanceOf(SimpleLogicError);
    });
  });

  describe('getFilesToModify', () => {
    it('should return empty map', async () => {
      const files = await module.getFilesToModify();

      expect(files.size).toBe(0);
    });
  });
});