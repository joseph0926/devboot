import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { AddCommand } from '../../../../src/cli/commands/add.command';
import { AddFlow } from '../../../../src/cli/flows/add/add.flow';
import { CLIErrorHandler } from '../../../../src/errors/cli/cli-error-handler';

vi.mock('../../../../src/cli/flows/add/add.flow');
vi.mock('../../../../src/core/installer');
vi.mock('../../../../src/errors/cli/cli-error-handler');

describe('AddCommand', () => {
  let program: Command;
  let mockAddFlow: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit during tests

    mockAddFlow = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(AddFlow).mockImplementation(
      () => mockAddFlow as unknown as AddFlow
    );
    vi.mocked(CLIErrorHandler.handle).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register add command with correct configuration', () => {
      AddCommand.register(program);

      const addCommand = program.commands.find((cmd) => cmd.name() === 'add');
      expect(addCommand).toBeDefined();
      expect(addCommand?.description()).toBe(
        'Add specific modules to your project'
      );
    });

    it('should have all required options', () => {
      AddCommand.register(program);

      const addCommand = program.commands.find((cmd) => cmd.name() === 'add');
      const options = addCommand?.options;

      expect(options).toContainEqual(
        expect.objectContaining({
          flags: '--no-install',
          description: 'Skip dependency installation',
        })
      );

      expect(options).toContainEqual(
        expect.objectContaining({
          flags: '-v, --verbose',
          description: 'Show detailed output',
        })
      );

      expect(options).toContainEqual(
        expect.objectContaining({
          flags: '--dry-run',
          description: 'Show what would be installed without making changes',
        })
      );
    });
  });

  describe('action', () => {
    beforeEach(() => {
      AddCommand.register(program);
    });

    it('should execute AddFlow with single module', async () => {
      const argv = ['node', 'test', 'add', 'eslint'];
      await program.parseAsync(argv);

      expect(AddFlow).toHaveBeenCalledTimes(1);
      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint'],
        noInstall: false,
        verbose: false,
        dryRun: false,
      });
    });

    it('should execute AddFlow with multiple modules', async () => {
      const argv = ['node', 'test', 'add', 'eslint', 'prettier', 'typescript'];
      await program.parseAsync(argv);

      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint', 'prettier', 'typescript'],
        noInstall: false,
        verbose: false,
        dryRun: false,
      });
    });

    it('should handle --no-install option', async () => {
      const argv = ['node', 'test', 'add', 'eslint', '--no-install'];
      await program.parseAsync(argv);

      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint'],
        noInstall: true,
        verbose: false,
        dryRun: false,
      });
    });

    it('should handle --verbose option', async () => {
      const argv = ['node', 'test', 'add', 'eslint', '--verbose'];
      await program.parseAsync(argv);

      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint'],
        noInstall: false,
        verbose: true,
        dryRun: false,
      });
    });

    it('should handle --dry-run option', async () => {
      const argv = ['node', 'test', 'add', 'eslint', '--dry-run'];
      await program.parseAsync(argv);

      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint'],
        noInstall: false,
        verbose: false,
        dryRun: true,
      });
    });

    it('should handle multiple options together', async () => {
      const argv = [
        'node',
        'test',
        'add',
        'eslint',
        'prettier',
        '--verbose',
        '--dry-run',
        '--no-install',
      ];
      await program.parseAsync(argv);

      expect(mockAddFlow.execute).toHaveBeenCalledWith({
        modules: ['eslint', 'prettier'],
        noInstall: true,
        verbose: true,
        dryRun: true,
      });
    });

    it('should handle errors with CLIErrorHandler', async () => {
      const error = new Error('Installation failed');
      mockAddFlow.execute.mockRejectedValueOnce(error);

      const argv = ['node', 'test', 'add', 'eslint', '--verbose'];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(error, {
        verbose: true,
        showHelp: true,
      });
    });

    it('should pass verbose option to error handler', async () => {
      const error = new Error('Installation failed');
      mockAddFlow.execute.mockRejectedValueOnce(error);

      const argv = ['node', 'test', 'add', 'eslint'];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(error, {
        verbose: undefined,
        showHelp: true,
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      AddCommand.register(program);
    });

    it('should require at least one module', async () => {
      const argv = ['node', 'test', 'add'];

      await expect(program.parseAsync(argv)).rejects.toThrow();
    });

    it('should handle AddFlow constructor errors', async () => {
      const constructorError = new Error('Failed to initialize');
      vi.mocked(AddFlow).mockImplementationOnce(() => {
        throw constructorError;
      });

      const argv = ['node', 'test', 'add', 'eslint'];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(constructorError, {
        verbose: undefined,
        showHelp: true,
      });
    });
  });
});
