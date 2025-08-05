import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TSConfigAnalyzer } from '../../../src/modules/typescript/analyzer';

vi.mock('../../../src/utils/file', () => ({
  readFile: vi.fn(),
}));

describe('TSConfigAnalyzer', () => {
  let analyzer: TSConfigAnalyzer;
  let readFileMock: any;

  beforeEach(async () => {
    analyzer = new TSConfigAnalyzer();
    const fileUtils = await import('../../../src/utils/file');
    readFileMock = vi.mocked(fileUtils.readFile);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze valid tsconfig.json', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          strict: true,
        },
        include: ['src/**/*'],
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.isValid).toBe(true);
      expect(result.config).toEqual(config);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle JSON parse errors', async () => {
      readFileMock.mockResolvedValue('{ invalid json }');

      const result = await analyzer.analyze('/test/project');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should handle file read errors', async () => {
      readFileMock.mockRejectedValue(new Error('File not found'));

      const result = await analyzer.analyze('/test/project');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Failed to read tsconfig.json: Error: File not found');
    });

    it('should warn about missing compilerOptions', async () => {
      const config = {
        include: ['src/**/*'],
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No compilerOptions found');
    });

    it('should warn about missing target', async () => {
      const config = {
        compilerOptions: {
          module: 'ESNext',
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.warnings).toContain('No target specified, defaulting to ES3');
    });

    it('should warn about missing module system', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.warnings).toContain('No module system specified');
    });

    it('should suggest enabling strict mode', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          strict: false,
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.suggestions).toContain(
        'Consider enabling strict mode for better type safety'
      );
    });

    it('should suggest upgrading old targets', async () => {
      const config = {
        compilerOptions: {
          target: 'ES5',
          module: 'CommonJS',
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.suggestions).toContain(
        'Consider upgrading target to ES2022 for modern JavaScript features'
      );
    });

    it('should warn about missing include or files', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.warnings).toContain(
        "No 'include' or 'files' specified. All TypeScript files will be included."
      );
    });

    it('should warn about JSX without proper target', async () => {
      const config = {
        compilerOptions: {
          jsx: 'react',
          target: 'CommonJS', // Invalid for JSX
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.warnings).toContain('JSX requires ES target for proper support');
    });

    it('should error when paths without baseUrl', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
          paths: {
            '@/*': ['./src/*'],
          },
          // missing baseUrl
        },
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.errors).toContain("'paths' requires 'baseUrl' to be specified");
    });

    it('should pass with valid React configuration', async () => {
      const config = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          jsx: 'react-jsx',
          strict: true,
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src/**/*'],
      };

      readFileMock.mockResolvedValue(JSON.stringify(config));

      const result = await analyzer.analyze('/test/project');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});