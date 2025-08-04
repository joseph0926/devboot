import fs from "fs-extra";
import path from "path";
import type { PackageJson } from "../types/file.type";
import { SimpleLogicError } from "../errors/logic.error";
import { LogicErrorCodes, FSError, isNodeError } from "../types/error.type";
import {
  ProjectInvalidError,
  ProjectNotFoundError,
} from "../errors/logic/project.error";

export async function readPackageJson(
  projectPath: string,
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
      },
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
        error,
      );
    }

    if (isNodeError(error)) {
      const fsError = error as FSError;
      throw new SimpleLogicError(
        LogicErrorCodes.FILE_READ_ERROR,
        `Failed to read package.json: ${error.message}`,
        false,
        {
          packageJsonPath,
          errorCode: fsError.code,
          syscall: fsError.syscall,
        },
        "Check file permissions and try again.",
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
      },
      "Check file permissions and try again.",
    );
  }
}

export async function writePackageJson(
  projectPath: string,
  content: any,
): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");

  try {
    await fs.writeJson(packageJsonPath, content, { spaces: 2 });
  } catch (error) {
    if (isNodeError(error)) {
      const fsError = error as FSError;

      if (fsError.code === "EACCES" || fsError.code === "EPERM") {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_PERMISSION_ERROR,
          "Permission denied writing package.json",
          false,
          {
            packageJsonPath,
            errorCode: fsError.code,
          },
          "Try running with elevated permissions (sudo)",
        );
      }

      if (fsError.code === "ENOSPC") {
        throw new SimpleLogicError(
          LogicErrorCodes.DISK_FULL,
          "Not enough disk space to write package.json",
          false,
          { packageJsonPath },
        );
      }
    }

    throw new SimpleLogicError(
      LogicErrorCodes.FILE_WRITE_ERROR,
      error instanceof Error
        ? `Failed to write package.json: ${error.message}`
        : "Failed to write package.json",
      false,
      { packageJsonPath },
    );
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await fs.pathExists(filePath);
  } catch (error) {
    // 파일 존재 확인 중 에러는 false로 처리
    return false;
  }
}

export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (isNodeError(error)) {
      const fsError = error as FSError;

      if (fsError.code === "ENOENT") {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_NOT_FOUND,
          `File not found: ${filePath}`,
          false,
          { filePath },
        );
      }

      if (fsError.code === "EACCES" || fsError.code === "EPERM") {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_PERMISSION_ERROR,
          `Permission denied reading file: ${filePath}`,
          false,
          {
            filePath,
            errorCode: fsError.code,
          },
          "Check file permissions",
        );
      }
    }

    throw new SimpleLogicError(
      LogicErrorCodes.FILE_READ_ERROR,
      error instanceof Error
        ? `Failed to read file: ${error.message}`
        : "Failed to read file",
      false,
      { filePath },
    );
  }
}

export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.ensureFile(filePath);
    await fs.writeFile(filePath, content);
  } catch (error) {
    if (isNodeError(error)) {
      const fsError = error as FSError;

      if (fsError.code === "EACCES" || fsError.code === "EPERM") {
        throw new SimpleLogicError(
          LogicErrorCodes.FILE_PERMISSION_ERROR,
          `Permission denied writing file: ${filePath}`,
          false,
          {
            filePath,
            errorCode: fsError.code,
          },
          "Try running with elevated permissions (sudo)",
        );
      }

      if (fsError.code === "ENOSPC") {
        throw new SimpleLogicError(
          LogicErrorCodes.DISK_FULL,
          "Not enough disk space",
          false,
          { filePath },
        );
      }
    }

    throw new SimpleLogicError(
      LogicErrorCodes.FILE_WRITE_ERROR,
      error instanceof Error
        ? `Failed to write file: ${error.message}`
        : "Failed to write file",
      false,
      { filePath },
    );
  }
}
