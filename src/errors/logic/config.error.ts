import { LogicError } from "../logic.error";
import { LogicErrorCodes } from "../../types/error.type";

interface ConfigErrorContext {
  configName?: string;
  filePath?: string;
  conflicts?: string[];
  availableConfigs?: string[];
  errorCode?: string;
  originalError?: string;
}

export class ConfigReadError extends LogicError<ConfigErrorContext> {
  readonly code = LogicErrorCodes.CONFIG_READ_ERROR;
  readonly isRecoverable = false;

  override get solution() {
    const { filePath, errorCode } = this.context || {};

    if (errorCode === "EACCES") {
      return "Check file permissions or run with elevated privileges";
    }

    if (errorCode === "ENOENT") {
      return filePath
        ? `Ensure file exists at '${filePath}'`
        : "Check if the configuration file exists";
    }

    return "Verify the configuration file is accessible and not corrupted";
  }
}

export class ConfigParseError extends LogicError<ConfigErrorContext> {
  readonly code = LogicErrorCodes.CONFIG_PARSE_ERROR;
  readonly isRecoverable = false;

  override get solution() {
    const { configName, filePath } = this.context || {};

    const fileName = filePath?.split("/").pop();

    return fileName
      ? `Check if '${fileName}' has valid JSON/JavaScript syntax`
      : `Verify ${configName || "configuration"} file syntax is correct`;
  }
}

export class ConfigNotFoundError extends LogicError<ConfigErrorContext> {
  readonly code = LogicErrorCodes.CONFIG_NOT_FOUND;
  readonly isRecoverable = true;

  override get solution() {
    const { configName, availableConfigs } = this.context || {};

    if (configName && availableConfigs?.length) {
      return `Configuration '${configName}' not found. Available: ${availableConfigs.join(
        ", "
      )}`;
    }

    return configName
      ? `Run 'devboot add ${configName}' to add this configuration`
      : "Check available configurations with 'devboot list'";
  }
}

export class ConfigConflictError extends LogicError<ConfigErrorContext> {
  readonly code = LogicErrorCodes.CONFIG_CONFLICT;
  readonly isRecoverable = true;

  override get solution() {
    const { configName, conflicts } = this.context || {};

    if (!conflicts?.length) {
      return "Remove conflicting configurations";
    }

    if (conflicts.length === 1) {
      return `${configName} conflicts with ${conflicts[0]}. Remove one of them`;
    }

    return `${configName} conflicts with: ${conflicts.join(
      ", "
    )}. Keep only one`;
  }
}

export class ProjectNotValidError extends LogicError<ConfigErrorContext> {
  readonly code = LogicErrorCodes.PROJECT_NOT_VALID;
  readonly isRecoverable = false;

  override get solution() {
    const { filePath } = this.context || {};

    if (filePath?.includes("package.json")) {
      return "Ensure package.json exists and is valid JSON";
    }

    return "Run this command in a Node.js project directory with package.json";
  }
}
