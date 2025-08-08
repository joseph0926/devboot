import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readPackageJson, writePackageJson, fileExists, readFile, writeFile } from '../../../src/utils/file';
import { SimpleLogicError } from '../../../src/errors/logic.error';
import { ProjectNotFoundError, ProjectInvalidError } from '../../../src/errors/logic/project.error';

vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    writeJson: vi.fn(),
    pathExists: vi.fn(),
    ensureFile: vi.fn(),
  },
}));

describe('file utils', () => {
  let fsExtraMock: typeof import('fs-extra').default;

  beforeEach(async () => {
    const fsExtra = await import('fs-extra');
    fsExtraMock = vi.mocked(fsExtra.default);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('readPackageJson', () => {
    it('should read and parse valid package.json', async () => {
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: { react: '^18.0.0' },
      };

      fsExtraMock.pathExists.mockResolvedValue(true);
      fsExtraMock.readFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await readPackageJson('/test/project');

      expect(result).toEqual(mockPackageJson);
      expect(fsExtraMock.readFile).toHaveBeenCalledWith(
        '/test/project/package.json',
        'utf-8'
      );
    });

    it('should throw ProjectNotFoundError when package.json does not exist', async () => {
      fsExtraMock.pathExists.mockResolvedValue(false);

      await expect(readPackageJson('/test/project')).rejects.toThrow(ProjectNotFoundError);
      await expect(readPackageJson('/test/project')).rejects.toThrow('No package.json found');
    });

    it('should throw ProjectInvalidError for invalid JSON', async () => {
      fsExtraMock.pathExists.mockResolvedValue(true);
      fsExtraMock.readFile.mockResolvedValue('{ invalid json }');

      await expect(readPackageJson('/test/project')).rejects.toThrow(ProjectInvalidError);
    });

    it('should throw SimpleLogicError for file read errors', async () => {
      fsExtraMock.pathExists.mockResolvedValue(true);
      const error = new Error('EACCES: permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      fsExtraMock.readFile.mockRejectedValue(error);

      await expect(readPackageJson('/test/project')).rejects.toThrow(SimpleLogicError);
    });

    it('should throw error when package.json is not an object', async () => {
      fsExtraMock.pathExists.mockResolvedValue(true);
      fsExtraMock.readFile.mockResolvedValue('"string value"');

      await expect(readPackageJson('/test/project')).rejects.toThrow(SimpleLogicError);
    });
  });

  describe('writePackageJson', () => {
    it('should write package.json with proper formatting', async () => {
      const content = { name: 'test', version: '1.0.0' };
      fsExtraMock.writeJson.mockResolvedValue(undefined);

      await writePackageJson('/test/project', content);

      expect(fsExtraMock.writeJson).toHaveBeenCalledWith(
        '/test/project/package.json',
        content,
        { spaces: 2 }
      );
    });

    it('should throw permission error', async () => {
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      fsExtraMock.writeJson.mockRejectedValue(error);

      await expect(writePackageJson('/test/project', {})).rejects.toThrow(SimpleLogicError);
      await expect(writePackageJson('/test/project', {})).rejects.toThrow('Permission denied');
    });

    it('should throw disk full error', async () => {
      const error = new Error('No space');
      (error as NodeJS.ErrnoException).code = 'ENOSPC';
      fsExtraMock.writeJson.mockRejectedValue(error);

      await expect(writePackageJson('/test/project', {})).rejects.toThrow(SimpleLogicError);
      await expect(writePackageJson('/test/project', {})).rejects.toThrow('Not enough disk space');
    });

    it('should throw generic write error for unknown errors', async () => {
      fsExtraMock.writeJson.mockRejectedValue(new Error('Unknown error'));

      await expect(writePackageJson('/test/project', {})).rejects.toThrow(SimpleLogicError);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      fsExtraMock.pathExists.mockResolvedValue(true);

      const result = await fileExists('/test/file.txt');

      expect(result).toBe(true);
      expect(fsExtraMock.pathExists).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false when file does not exist', async () => {
      fsExtraMock.pathExists.mockResolvedValue(false);

      const result = await fileExists('/test/file.txt');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      fsExtraMock.pathExists.mockRejectedValue(new Error('Permission denied'));

      const result = await fileExists('/test/file.txt');

      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content', async () => {
      const content = 'file content';
      fsExtraMock.readFile.mockResolvedValue(content);

      const result = await readFile('/test/file.txt');

      expect(result).toBe(content);
      expect(fsExtraMock.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
    });

    it('should throw FILE_NOT_FOUND error', async () => {
      const error = new Error('File not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      fsExtraMock.readFile.mockRejectedValue(error);

      await expect(readFile('/test/file.txt')).rejects.toThrow(SimpleLogicError);
      await expect(readFile('/test/file.txt')).rejects.toThrow('File not found');
    });

    it('should throw permission error', async () => {
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      fsExtraMock.readFile.mockRejectedValue(error);

      await expect(readFile('/test/file.txt')).rejects.toThrow(SimpleLogicError);
      await expect(readFile('/test/file.txt')).rejects.toThrow('Permission denied');
    });

    it('should throw generic read error', async () => {
      fsExtraMock.readFile.mockRejectedValue(new Error('Unknown error'));

      await expect(readFile('/test/file.txt')).rejects.toThrow(SimpleLogicError);
    });
  });

  describe('writeFile', () => {
    it('should write file content', async () => {
      fsExtraMock.ensureFile.mockResolvedValue(undefined);
      fsExtraMock.writeFile.mockResolvedValue(undefined);

      await writeFile('/test/file.txt', 'content');

      expect(fsExtraMock.ensureFile).toHaveBeenCalledWith('/test/file.txt');
      expect(fsExtraMock.writeFile).toHaveBeenCalledWith('/test/file.txt', 'content');
    });

    it('should throw permission error', async () => {
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EPERM';
      fsExtraMock.ensureFile.mockRejectedValue(error);

      await expect(writeFile('/test/file.txt', 'content')).rejects.toThrow(SimpleLogicError);
      await expect(writeFile('/test/file.txt', 'content')).rejects.toThrow('Permission denied');
    });

    it('should throw disk full error', async () => {
      const error = new Error('No space');
      (error as NodeJS.ErrnoException).code = 'ENOSPC';
      fsExtraMock.ensureFile.mockResolvedValue(undefined);
      fsExtraMock.writeFile.mockRejectedValue(error);

      await expect(writeFile('/test/file.txt', 'content')).rejects.toThrow(SimpleLogicError);
      await expect(writeFile('/test/file.txt', 'content')).rejects.toThrow('Not enough disk space');
    });

    it('should throw generic write error', async () => {
      fsExtraMock.ensureFile.mockResolvedValue(undefined);
      fsExtraMock.writeFile.mockRejectedValue(new Error('Unknown error'));

      await expect(writeFile('/test/file.txt', 'content')).rejects.toThrow(SimpleLogicError);
    });
  });
});