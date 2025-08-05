import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModuleInstaller } from "../../../src/core/installer";
import { SimpleLogicError } from "../../../src/errors/logic.error";
import { BaseModule } from "../../../src/modules/base.module";

// Simple mock for testing core functionality
vi.mock("../../../src/core/project-analyzer", () => ({
  ProjectAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      projectPath: "/test/project",
      name: "test-project",
      version: "1.0.0",
      packageJson: { name: "test-project" },
      projectType: "node",
      packageManager: "npm",
      hasTypeScript: false,
      hasSrcDirectory: true,
      hasTestDirectory: false,
    }),
  })),
}));

vi.mock("../../../src/core/package-manager", () => ({
  PackageManagerService: vi.fn().mockImplementation(() => ({
    install: vi.fn().mockResolvedValue({ success: true, installed: [] }),
  })),
}));

vi.mock("../../../src/modules", () => ({
  ModuleRegistry: {
    get: vi.fn(),
    list: vi.fn().mockReturnValue(["prettier", "eslint", "typescript"]),
  },
}));

describe("ModuleInstaller", () => {
  let installer: ModuleInstaller;

  beforeEach(() => {
    installer = new ModuleInstaller();
  });

  describe("prepareContext", () => {
    it("should prepare project context", async () => {
      const context = await installer.prepareContext("/test/project");

      expect(context.projectPath).toBe("/test/project");
      expect(context.projectType).toBe("node");
      expect(context.packageManager).toBe("npm");
      expect(context.hasTypeScript).toBe(false);
    });
  });

  describe("installModule", () => {
    it("should throw error for unknown module", async () => {
      const { ModuleRegistry } = await import("../../../src/modules");
      vi.mocked(ModuleRegistry.get).mockReturnValue(undefined);

      await expect(
        installer.installModule("unknown", "/test/project")
      ).rejects.toThrow(SimpleLogicError);
      await expect(
        installer.installModule("unknown", "/test/project")
      ).rejects.toThrow("Module 'unknown' not found");
    });

    it("should handle module installation", async () => {
      const mockModule = {
        name: "prettier",
        install: vi.fn().mockResolvedValue({ success: true }),
        getDependencies: vi
          .fn()
          .mockResolvedValue({ devDependencies: { prettier: "^3.0.0" } }),
      };

      const { ModuleRegistry } = await import("../../../src/modules");
      vi.mocked(ModuleRegistry.get).mockReturnValue(
        mockModule as unknown as BaseModule
      );

      const result = await installer.installModule("prettier", "/test/project");

      expect(result.success).toBe(true);
      expect(mockModule.install).toHaveBeenCalled();
    });
  });
});
