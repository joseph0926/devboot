import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from "vitest";
import { Command } from "commander";
import chalk from "chalk";
import { log } from "@clack/prompts";
import { ListCommand } from "../../../../src/cli/commands/list.command";
import { ModuleRegistry } from "../../../../src/modules";
import { readPackageJson } from "../../../../src/utils/file";
import { CLIErrorHandler } from "../../../../src/errors/cli/cli-error-handler";
import { ErrorLogger } from "../../../../src/utils/error-logger";
import { BaseModule } from "../../../../src/modules/base.module";

vi.mock("@clack/prompts");
vi.mock("../../../../src/modules");
vi.mock("../../../../src/utils/file");
vi.mock("../../../../src/errors/cli/cli-error-handler");
vi.mock("../../../../src/utils/error-logger");
vi.mock("../../../../src/utils/logger");

describe("ListCommand", () => {
  let program: Command;
  let mockModules: BaseModule[];
  let processExitSpy: MockedFunction<typeof process.exit>;
  let consoleLogSpy: MockedFunction<typeof console.log>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit during tests
    
    // Mock modules
    mockModules = [
      {
        name: "eslint",
        description: "JavaScript/TypeScript linter",
        isInstalled: vi.fn().mockResolvedValue(true),
      } as unknown as BaseModule,
      {
        name: "prettier",
        description: "Code formatter",
        isInstalled: vi.fn().mockResolvedValue(false),
      } as unknown as BaseModule,
      {
        name: "typescript",
        description: "TypeScript configuration",
        isInstalled: vi.fn().mockResolvedValue(true),
      } as unknown as BaseModule,
    ];
    
    vi.mocked(ModuleRegistry.getAll).mockReturnValue(mockModules);
    vi.mocked(CLIErrorHandler.handle).mockImplementation(() => {});
    vi.mocked(log.message).mockImplementation(() => {});
    vi.mocked(readPackageJson).mockResolvedValue({
      name: "test-project",
      version: "1.0.0",
    });
    
    // Mock process.exit
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
    
    // Keep console.log for debugging
    consoleLogSpy = vi.spyOn(console, "log");
  });

  afterEach(() => {
    vi.clearAllMocks();
    processExitSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe("register", () => {
    it("should register list command with correct configuration", () => {
      ListCommand.register(program);
      
      const listCommand = program.commands.find(cmd => cmd.name() === "list");
      expect(listCommand).toBeDefined();
      expect(listCommand?.description()).toBe("List available modules");
      expect(listCommand?.alias()).toBe("ls");
    });

    it("should have installed option", () => {
      ListCommand.register(program);
      
      const listCommand = program.commands.find(cmd => cmd.name() === "list");
      const options = listCommand?.options;
      
      expect(options).toContainEqual(
        expect.objectContaining({
          flags: "-i, --installed",
          description: "Show only installed modules",
        })
      );
    });
  });

  describe("execute - in project", () => {
    beforeEach(() => {
      ListCommand.register(program);
    });

    it("should list all modules with installation status", async () => {
      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(chalk.bold("\n📦 Available DevBoot Modules:\n"));
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining("eslint")
      );
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining("prettier")
      );
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining("typescript")
      );
      
      // Check status indicators
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining(chalk.green("✓ installed"))
      );
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining(chalk.gray("not installed"))
      );
    });

    it("should show help messages when not filtering", async () => {
      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(
        chalk.gray("Use 'devboot add <module>' to add a module")
      );
      expect(log.message).toHaveBeenCalledWith(
        chalk.gray("Use 'devboot list -i' to see only installed modules")
      );
    });

    it("should filter to show only installed modules with -i option", async () => {
      const argv = ["node", "test", "list", "-i"];
      await program.parseAsync(argv);

      // Should show eslint and typescript (installed), but not prettier
      const messages = vi.mocked(log.message).mock.calls.map(call => call[0]);
      const moduleMessages = messages.filter(msg => 
        typeof msg === "string" && 
        (msg.includes("eslint") || msg.includes("prettier") || msg.includes("typescript"))
      );

      expect(moduleMessages.some(msg => msg.includes("eslint"))).toBe(true);
      expect(moduleMessages.some(msg => msg.includes("typescript"))).toBe(true);
      expect(moduleMessages.some(msg => msg.includes("prettier"))).toBe(false);
    });

    it("should show 'no modules installed' message when no modules are installed", async () => {
      // Mock all modules as not installed
      mockModules.forEach(module => {
        vi.mocked(module.isInstalled).mockResolvedValue(false);
      });

      const argv = ["node", "test", "list", "-i"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(
        chalk.gray("  No modules installed yet")
      );
    });

    it("should handle module check errors gracefully", async () => {
      // Make one module throw an error
      vi.mocked(mockModules[0].isInstalled).mockRejectedValue(
        new Error("Check failed")
      );

      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      // Should still show other modules
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining("prettier")
      );
      expect(log.message).toHaveBeenCalledWith(
        expect.stringContaining("typescript")
      );
    });
  });

  describe("execute - not in project", () => {
    beforeEach(() => {
      ListCommand.register(program);
      vi.mocked(readPackageJson).mockRejectedValue(new Error("No package.json"));
    });

    it("should list all modules without installation status", async () => {
      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(chalk.bold("\n📦 Available DevBoot Modules:\n"));
      
      // Should show modules without status
      const messages = vi.mocked(log.message).mock.calls.map(call => call[0]);
      const moduleMessages = messages.filter(msg => 
        typeof msg === "string" && msg.includes("eslint")
      );
      
      expect(moduleMessages.length).toBeGreaterThan(0);
      expect(moduleMessages[0]).not.toContain("✓ installed");
      expect(moduleMessages[0]).not.toContain("not installed");
    });

    it("should show init prompt when not in project", async () => {
      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(
        chalk.gray("Run 'devboot init' in a project to get started")
      );
    });

    it("should exit gracefully with --installed option when not in project", async () => {
      const argv = ["node", "test", "list", "--installed"];
      
      try {
        await program.parseAsync(argv);
      } catch (error: any) {
        expect(error.message).toBe("process.exit(0)");
      }

      expect(ErrorLogger.logWarning).toHaveBeenCalledWith(
        "Not in a Node.js project - cannot check installed modules"
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      ListCommand.register(program);
    });

    it("should handle errors with CLIErrorHandler", async () => {
      const error = new Error("List command failed");
      vi.mocked(ModuleRegistry.getAll).mockImplementation(() => {
        throw error;
      });

      const argv = ["node", "test", "list"];
      await program.parseAsync(argv);

      expect(CLIErrorHandler.handle).toHaveBeenCalledWith(error, {
        verbose: false,
        showHelp: false,
      });
    });
  });

  describe("alias", () => {
    beforeEach(() => {
      ListCommand.register(program);
    });

    it("should work with 'ls' alias", async () => {
      const argv = ["node", "test", "ls"];
      await program.parseAsync(argv);

      expect(log.message).toHaveBeenCalledWith(chalk.bold("\n📦 Available DevBoot Modules:\n"));
    });

    it("should work with 'ls -i' alias", async () => {
      const argv = ["node", "test", "ls", "-i"];
      await program.parseAsync(argv);

      const messages = vi.mocked(log.message).mock.calls.map(call => call[0]);
      const moduleMessages = messages.filter(msg => 
        typeof msg === "string" && msg.includes("eslint")
      );
      
      expect(moduleMessages.length).toBeGreaterThan(0);
    });
  });
});