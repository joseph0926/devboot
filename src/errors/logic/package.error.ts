import { LogicErrorCodes } from "../../types/error.type";
import { PackageManager } from "../../types/project.type";
import { LogicError } from "../logic.error";

interface PackageErrorContext {
  packageManager: PackageManager;
  packages?: string[];
  command?: string;
  errorCode?: string;
  stderr?: string;
  originalError?: string;
}

export class PackageManagerNotFoundError extends LogicError<PackageErrorContext> {
  readonly code = LogicErrorCodes.PKG_MANAGER_NOT_FOUND;
  readonly isRecoverable = false;

  override get solution() {
    const { packageManager } = this.context || {};

    const installGuides: Record<string, string> = {
      npm: "npm is included with Node.js - https://nodejs.org",
      pnpm: "Install with: npm install -g pnpm",
      yarn: "Install with: npm install -g yarn",
      bun: "Install from: https://bun.sh",
    };

    if (packageManager && packageManager in installGuides) {
      return installGuides[packageManager];
    }

    return "Please install the required package manager";
  }
}

export class PackageInstallError extends LogicError<PackageErrorContext> {
  readonly code = LogicErrorCodes.PKG_INSTALL_FAILED;
  readonly isRecoverable = true;

  override get solution() {
    const { stderr, packages } = this.context || {};

    if (stderr?.includes("E404")) {
      const packageList = packages?.join(", ");
      return packageList
        ? `Package(s) not found: ${packageList}. Check package names and try again.`
        : "One or more packages not found. Check package names and try again.";
    }

    if (stderr?.includes("EACCES")) {
      return "Permission error. Try fixing npm permissions or use a different directory.";
    }

    if (stderr?.includes("peer dep")) {
      return "Peer dependency conflict. Try --legacy-peer-deps or --force flag.";
    }

    if (stderr?.includes("ERESOLVE")) {
      return "Dependency resolution error. Try --force or --legacy-peer-deps flag.";
    }

    if (stderr?.includes("EINTEGRITY")) {
      return "Package integrity check failed. Try clearing cache and reinstalling.";
    }

    if (packages && packages.length > 0) {
      return `Failed to install: ${packages.join(
        ", ",
      )}. Check the error message above.`;
    }

    return "Check the error message above and try again. You may need to clear cache.";
  }
}

export class PackageManagerExecutionError extends LogicError<PackageErrorContext> {
  readonly code = LogicErrorCodes.PKG_MANAGER_EXECUTION_ERROR;
  readonly isRecoverable = true;

  override get solution() {
    const { stderr, command, packageManager } = this.context || {};

    if (stderr?.includes("lock file")) {
      return `Lock file issue detected. Try deleting the lock file and running ${
        packageManager || "the package manager"
      } again.`;
    }

    if (stderr?.includes("ENOSPC")) {
      return "Not enough disk space. Free up some space and try again.";
    }

    if (command) {
      return `Command failed: ${command}. Check the output above for details.`;
    }

    return "Check the package manager output above for specific errors.";
  }
}
