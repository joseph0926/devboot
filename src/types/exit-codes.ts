export enum ExitCodes {
  SUCCESS = 0,

  GENERAL_ERROR = 1,
  UNKNOWN_ERROR = 2,
  USER_CANCELLED = 3,
  INVALID_ARGUMENT = 4,
  COMMAND_NOT_FOUND = 5,

  MODULE_NOT_FOUND = 10,
  MODULE_INSTALL_FAILED = 11,
  CONFIG_ERROR = 12,
  CONFIG_CONFLICT = 13,
  VALIDATION_ERROR = 14,

  FILE_NOT_FOUND = 30,
  FILE_READ_ERROR = 31,
  FILE_WRITE_ERROR = 32,
  FILE_PERMISSION_ERROR = 33,

  NETWORK_ERROR = 50,
  PACKAGE_INSTALL_FAILED = 51,
  DEPENDENCY_ERROR = 52,

  NOT_IN_PROJECT = 100,
  PROJECT_INVALID = 101,
  PACKAGE_JSON_NOT_FOUND = 102,
  PACKAGE_JSON_INVALID = 103,
  PACKAGE_MANAGER_NOT_FOUND = 110,
  NODE_VERSION_ERROR = 120,

  PERMISSION_DENIED = 200,
  DISK_FULL = 201,
  PROCESS_ERROR = 202,
}

export function getExitCodeFromError(errorCode: string): number {
  const mapping: Record<string, ExitCodes> = {
    COMMAND_NOT_FOUND: ExitCodes.COMMAND_NOT_FOUND,
    INVALID_ARGUMENT: ExitCodes.INVALID_ARGUMENT,
    USER_CANCELLED: ExitCodes.USER_CANCELLED,
    NOT_IN_PROJECT: ExitCodes.NOT_IN_PROJECT,
    PERMISSION_DENIED: ExitCodes.PERMISSION_DENIED,

    PROJECT_NOT_FOUND: ExitCodes.NOT_IN_PROJECT,
    PROJECT_INVALID: ExitCodes.PROJECT_INVALID,
    PROJECT_NOT_VALID: ExitCodes.PROJECT_INVALID,

    PKG_MANAGER_NOT_FOUND: ExitCodes.PACKAGE_MANAGER_NOT_FOUND,
    PKG_INSTALL_FAILED: ExitCodes.PACKAGE_INSTALL_FAILED,

    CONFIG_PARSE_ERROR: ExitCodes.CONFIG_ERROR,
    CONFIG_CONFLICT: ExitCodes.CONFIG_CONFLICT,
    CONFIG_READ_ERROR: ExitCodes.CONFIG_ERROR,
    CONFIG_NOT_FOUND: ExitCodes.CONFIG_ERROR,

    MODULE_NOT_FOUND: ExitCodes.MODULE_NOT_FOUND,
    MODULE_INSTALL_FAILED: ExitCodes.MODULE_INSTALL_FAILED,

    FILE_NOT_FOUND: ExitCodes.FILE_NOT_FOUND,
    FILE_READ_ERROR: ExitCodes.FILE_READ_ERROR,
    FILE_WRITE_ERROR: ExitCodes.FILE_WRITE_ERROR,
    FILE_PERMISSION_ERROR: ExitCodes.FILE_PERMISSION_ERROR,

    NETWORK_ERROR: ExitCodes.NETWORK_ERROR,
    DISK_FULL: ExitCodes.DISK_FULL,
  };

  return mapping[errorCode] || ExitCodes.GENERAL_ERROR;
}

export function getExitCodeDescription(code: ExitCodes): string {
  const descriptions: Record<ExitCodes, string> = {
    [ExitCodes.SUCCESS]: "Success",
    [ExitCodes.GENERAL_ERROR]: "General error",
    [ExitCodes.UNKNOWN_ERROR]: "Unknown error",
    [ExitCodes.USER_CANCELLED]: "User cancelled",
    [ExitCodes.INVALID_ARGUMENT]: "Invalid argument",
    [ExitCodes.COMMAND_NOT_FOUND]: "Command not found",
    [ExitCodes.MODULE_NOT_FOUND]: "Module not found",
    [ExitCodes.MODULE_INSTALL_FAILED]: "Module installation failed",
    [ExitCodes.CONFIG_ERROR]: "Configuration error",
    [ExitCodes.CONFIG_CONFLICT]: "Configuration conflict",
    [ExitCodes.VALIDATION_ERROR]: "Validation failed",
    [ExitCodes.FILE_NOT_FOUND]: "File not found",
    [ExitCodes.FILE_READ_ERROR]: "File read error",
    [ExitCodes.FILE_WRITE_ERROR]: "File write error",
    [ExitCodes.FILE_PERMISSION_ERROR]: "File permission error",
    [ExitCodes.NETWORK_ERROR]: "Network error",
    [ExitCodes.PACKAGE_INSTALL_FAILED]: "Package installation failed",
    [ExitCodes.DEPENDENCY_ERROR]: "Dependency error",
    [ExitCodes.NOT_IN_PROJECT]: "Not in a project directory",
    [ExitCodes.PROJECT_INVALID]: "Invalid project",
    [ExitCodes.PACKAGE_JSON_NOT_FOUND]: "package.json not found",
    [ExitCodes.PACKAGE_JSON_INVALID]: "Invalid package.json",
    [ExitCodes.PACKAGE_MANAGER_NOT_FOUND]: "Package manager not found",
    [ExitCodes.NODE_VERSION_ERROR]: "Node.js version error",
    [ExitCodes.PERMISSION_DENIED]: "Permission denied",
    [ExitCodes.DISK_FULL]: "Disk full",
    [ExitCodes.PROCESS_ERROR]: "Process error",
  };

  return descriptions[code] || "Unknown exit code";
}
