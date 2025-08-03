import { readPackageJson, fileExists } from "../utils/file.js";
import type { PackageJson } from "../types/file.type.js";
import type {
  ProjectType,
  ProjectInfo,
  PackageManager,
} from "../types/project.type.js";
import path from "path";
import { SimpleLogicError } from "../errors/logic.error.js";
import { LogicErrorCodes } from "../types/error.type.js";
import { ProjectInvalidError } from "../errors/logic/project.error.js";

export class ProjectAnalyzer {
  async analyze(projectPath: string): Promise<ProjectInfo> {
    if (!(await fileExists(projectPath))) {
      throw new SimpleLogicError(
        LogicErrorCodes.PROJECT_NOT_FOUND,
        `Project path does not exist: ${projectPath}`,
        false,
        { projectPath, currentDir: process.cwd() },
        "Please check the project path and try again."
      );
    }

    let packageJson: PackageJson;
    try {
      packageJson = await readPackageJson(projectPath);
    } catch (error) {
      if (error instanceof Error) {
        throw new ProjectInvalidError(
          error.message,
          {
            projectPath,
            hasPackageJson: await fileExists(
              path.join(projectPath, "package.json")
            ),
          },
          error
        );
      }
      throw error;
    }

    return {
      projectPath,
      name: packageJson.name || "unnamed-project",
      version: packageJson.version || "0.0.0",
      packageJson,
      projectType: await this.detectProjectType(packageJson),
      packageManager: await this.detectPackageManager(projectPath, packageJson),
      hasTypeScript: await this.detectTypeScript(projectPath),
      hasSrcDirectory: await fileExists(path.join(projectPath, "src")),
      hasTestDirectory:
        (await fileExists(path.join(projectPath, "test"))) ||
        (await fileExists(path.join(projectPath, "tests"))) ||
        (await fileExists(path.join(projectPath, "__tests__"))),
    };
  }

  private async detectProjectType(
    packageJson: PackageJson
  ): Promise<ProjectType> {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps.next) {
      return "next";
    }

    if (deps.vite) {
      if (deps.react) {
        return "vite";
      }
    }

    if (deps.react) {
      return "react";
    }

    return "node";
  }

  private async detectPackageManager(
    projectPath: string,
    packageJson: PackageJson
  ): Promise<PackageManager> {
    if (await fileExists(path.join(projectPath, "bun.lockb"))) {
      return "bun";
    }
    if (await fileExists(path.join(projectPath, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (await fileExists(path.join(projectPath, "yarn.lock"))) {
      return "yarn";
    }
    if (await fileExists(path.join(projectPath, "package-lock.json"))) {
      return "npm";
    }

    if (
      packageJson.packageManager &&
      typeof packageJson.packageManager === "string"
    ) {
      const match = packageJson.packageManager.match(/^(npm|pnpm|yarn|bun)@/);
      if (match && match[1]) {
        return match[1] as PackageManager;
      }
    }

    return "npm";
  }

  private async detectTypeScript(projectPath: string): Promise<boolean> {
    if (await fileExists(path.join(projectPath, "tsconfig.json"))) {
      return true;
    }

    if (!(await fileExists(path.join(projectPath, "src")))) {
      return false;
    }

    const hasTypeScriptFiles =
      (await this.hasFilesWithExtension(
        path.join(projectPath, "src"),
        ".ts"
      )) ||
      (await this.hasFilesWithExtension(path.join(projectPath, "src"), ".tsx"));

    return hasTypeScriptFiles;
  }

  private async hasFilesWithExtension(
    directory: string,
    extension: string
  ): Promise<boolean> {
    try {
      const { readdir } = await import("fs/promises");
      const files = await readdir(directory);
      return files.some((file) => file.endsWith(extension));
    } catch {
      return false;
    }
  }
}
