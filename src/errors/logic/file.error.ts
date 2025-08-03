import { LogicError } from "../logic.error";
import { LogicErrorCodes } from "../../types/error.type";

interface FileErrorContext {
  path: string;
  operation: "read" | "write" | "create" | "modify" | "delete" | "mkdir";
  errorCode?: string;
  originalError?: string;
}

export class FileOperationError extends LogicError<FileErrorContext> {
  readonly code = LogicErrorCodes.FILE_OPERATION_ERROR;
  readonly isRecoverable = false;

  override get solution() {
    const { operation, path, errorCode } = this.context || {};

    const fileName = path?.split("/").pop();
    const directory = path?.substring(0, path.lastIndexOf("/"));

    switch (operation) {
      case "write":
      case "create":
        if (errorCode === "ENOSPC") {
          return "Not enough disk space. Free up some space and try again";
        }
        return directory
          ? `Ensure directory '${directory}' exists and you have write permissions`
          : "Check if the parent directory exists and you have write permissions";

      case "read":
        return fileName
          ? `Ensure file '${fileName}' exists in '${
              directory || "current directory"
            }' and you have read permissions`
          : "Check if the file exists and you have read permissions";

      case "mkdir":
        return path
          ? `Check if you have permission to create directory '${path}'`
          : "Check if you have permission to create directories";

      case "modify":
        return fileName
          ? `Ensure '${fileName}' is not locked by another process and you have write permissions`
          : "Check if the file is not locked and you have write permissions";

      case "delete":
        return path
          ? `Ensure '${path}' exists and you have delete permissions`
          : "Check if the file exists and you have delete permissions";

      default:
        return path
          ? `Check permissions for '${path}'`
          : "Check file permissions and path";
    }
  }
}

export class FileNotFoundError extends LogicError<FileErrorContext> {
  readonly code = LogicErrorCodes.FILE_NOT_FOUND;
  readonly isRecoverable = false;

  override get solution() {
    return "Ensure the file exists at the specified path";
  }
}

export class FilePermissionError extends LogicError<FileErrorContext> {
  readonly code = LogicErrorCodes.FILE_PERMISSION_ERROR;
  readonly isRecoverable = false;

  override get solution() {
    const { operation } = this.context || {};

    if (operation === "write" || operation === "create") {
      return "Try running with elevated permissions (sudo) or check directory ownership";
    }

    return "Check file permissions or run with elevated privileges";
  }
}
