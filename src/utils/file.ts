import fs from "fs-extra";
import path from "path";
import type { PackageJson } from "../types/file.type";
import { SimpleLogicError } from "../errors/logic.error";
import { LogicErrorCodes } from "../types/error.type";
import {
  ProjectInvalidError,
  ProjectNotFoundError,
} from "../errors/logic/project.error";

export async function readPackageJson(
  projectPath: string
): Promise<PackageJson> {
  const packageJsonPath = path.join(projectPath, "package.json");

  if (!(await fileExists(packageJsonPath))) {
    throw new ProjectNotFoundError(
      "No package.json found in project directory",
      {
        projectPath,
        searchedPath: packageJsonPath,
        hasPackageJson: false,
        suggestion: "npm init",
      }
    );
  }

  try {
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const parsed = JSON.parse(content);

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("package.json must be an object");
    }

    return parsed as PackageJson;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ProjectInvalidError(
        "Invalid package.json format",
        {
          projectPath,
          hasPackageJson: true,
          parseError: error.message,
        },
        error
      );
    }

    throw new SimpleLogicError(
      LogicErrorCodes.FILE_READ_ERROR,
      error instanceof Error
        ? `Failed to read package.json: ${error.message}`
        : "Failed to read package.json",
      false,
      {
        packageJsonPath,
        errorCode: (error as any).code,
      },
      "Check file permissions and try again."
    );
  }
}

export async function writePackageJson(
  projectPath: string,
  content: any
): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");
  await fs.writeJson(packageJsonPath, content, { spaces: 2 });
}

export async function fileExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.ensureFile(filePath);
  await fs.writeFile(filePath, content);
}
