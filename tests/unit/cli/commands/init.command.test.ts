import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { InitCommand } from "../../../../src/cli/commands/init.command";
import { InitFlow } from "../../../../src/cli/flows/init/init.flow";
import { CLIErrorHandler } from "../../../../src/errors/cli/cli-error-handler";

vi.mock("../../../../src/cli/flows/init/init.flow");
vi.mock("../../../../src/errors/cli/cli-error-handler");

describe("InitCommand", () => {
  let program: Command;
  let mockInitFlow: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit during tests
    
    mockInitFlow = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    
    vi.mocked(InitFlow).mockImplementation(() => mockInitFlow);
    vi.mocked(CLIErrorHandler.handle).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("should register init command with correct configuration", () => {
      InitCommand.register(program);
      
      const initCommand = program.commands.find(cmd => cmd.name() === "init");
      expect(initCommand).toBeDefined();
      expect(initCommand?.description()).toBe("Initialize DevBoot in your project");
    });

    it("should have all required options", () => {
      InitCommand.register(program);
      
      const initCommand = program.commands.find(cmd => cmd.name() === "init");
      const options = initCommand?.options;
      
      expect(options).toContainEqual(
        expect.objectContaining({
          flags: "-y, --yes",
          description: "Skip all prompts and use defaults",
        })
      );
      
      expect(options).toContainEqual(
        expect.objectContaining({
          flags: "-v, --verbose",
          description: "Show detailed output",
        })
      );
      
      expect(options).toContainEqual(
        expect.objectContaining({
          flags: "--dry-run",
          description: "Show what would be installed without making changes",
        })
      );
      
      expect(options).toContainEqual(
        expect.objectContaining({
          flags: "-f, --force",
          description: "Overwrite existing configurations",
        })
      );
    });
  });

  describe("action", () => {
    beforeEach(() => {
      InitCommand.register(program);
    });

    it("should execute InitFlow with default options", async () => {
      const argv = ["node", "test", "init"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: undefined,
        dryRun: undefined,
        force: undefined,
      });
      expect(mockInitFlow.execute).toHaveBeenCalledTimes(1);
    });

    it("should handle --yes option", async () => {
      const argv = ["node", "test", "init", "--yes"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: true,
        verbose: undefined,
        dryRun: undefined,
        force: undefined,
      });
    });

    it("should handle -y shorthand option", async () => {
      const argv = ["node", "test", "init", "-y"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: true,
        verbose: undefined,
        dryRun: undefined,
        force: undefined,
      });
    });

    it("should handle --verbose option", async () => {
      const argv = ["node", "test", "init", "--verbose"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: true,
        dryRun: undefined,
        force: undefined,
      });
    });

    it("should handle -v shorthand option", async () => {
      const argv = ["node", "test", "init", "-v"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: true,
        dryRun: undefined,
        force: undefined,
      });
    });

    it("should handle --dry-run option", async () => {
      const argv = ["node", "test", "init", "--dry-run"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: undefined,
        dryRun: true,
        force: undefined,
      });
    });

    it("should handle --force option", async () => {
      const argv = ["node", "test", "init", "--force"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: undefined,
        dryRun: undefined,
        force: true,
      });
    });

    it("should handle -f shorthand option", async () => {
      const argv = ["node", "test", "init", "-f"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: undefined,
        dryRun: undefined,
        force: true,
      });
    });

    it("should handle multiple options together", async () => {
      const argv = ["node", "test", "init", "-y", "-v", "--dry-run", "-f"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: true,
        verbose: true,
        dryRun: true,
        force: true,
      });
    });

    it("should handle errors with CLIErrorHandler", async () => {
      const error = new Error("Initialization failed");
      mockInitFlow.execute.mockRejectedValueOnce(error);

      const argv = ["node", "test", "init", "--verbose"];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(error, {
        verbose: true,
        showHelp: false,
      });
    });

    it("should not show help on error for init command", async () => {
      const error = new Error("Initialization failed");
      mockInitFlow.execute.mockRejectedValueOnce(error);

      const argv = ["node", "test", "init"];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(error, {
        verbose: undefined,
        showHelp: false,
      });
    });

    it("should handle InitFlow constructor errors", async () => {
      const constructorError = new Error("Failed to initialize flow");
      vi.mocked(InitFlow).mockImplementationOnce(() => {
        throw constructorError;
      });

      const argv = ["node", "test", "init", "-v"];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(constructorError, {
        verbose: true,
        showHelp: false,
      });
    });
  });

  describe("option combinations", () => {
    beforeEach(() => {
      InitCommand.register(program);
    });

    it("should handle conflicting options gracefully", async () => {
      // Test that dry-run with force still works
      const argv = ["node", "test", "init", "--dry-run", "--force"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: undefined,
        verbose: undefined,
        dryRun: true,
        force: true,
      });
      expect(mockInitFlow.execute).toHaveBeenCalledTimes(1);
    });

    it("should handle all short options together", async () => {
      const argv = ["node", "test", "init", "-yvf"];
      await program.parseAsync(argv);

      expect(InitFlow).toHaveBeenCalledWith({
        yes: true,
        verbose: true,
        dryRun: undefined,
        force: true,
      });
    });
  });
});