export const CLIErrorCodes = {
  COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  MISSING_ARGUMENT: "MISSING_ARGUMENT",

  USER_CANCELLED: "USER_CANCELLED",
  PROMPT_FAILED: "PROMPT_FAILED",

  PERMISSION_DENIED: "PERMISSION_DENIED",
  NOT_IN_PROJECT: "NOT_IN_PROJECT",
} as const;

export type CLIErrorCode = (typeof CLIErrorCodes)[keyof typeof CLIErrorCodes];

export const LogicErrorCodes = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  PROJECT_INVALID: "PROJECT_INVALID",
  PROJECT_ANALYSIS_FAILED: "PROJECT_ANALYSIS_FAILED",

  PKG_MANAGER_NOT_FOUND: "PKG_MANAGER_NOT_FOUND",
  PKG_INSTALL_FAILED: "PKG_INSTALL_FAILED",
  PKG_MANAGER_MISMATCH: "PKG_MANAGER_MISMATCH",

  CONFIG_PARSE_ERROR: "CONFIG_PARSE_ERROR",
  CONFIG_CONFLICT: "CONFIG_CONFLICT",
  CONFIG_MERGE_FAILED: "CONFIG_MERGE_FAILED",
  CONFIG_INVALID_FORMAT: "CONFIG_INVALID_FORMAT",
  CONFIG_GENERATION_FAILED: "CONFIG_GENERATION_FAILED",
  CONFIG_READ_ERROR: "CONFIG_READ_ERROR",
  CONFIG_NOT_FOUND: "CONFIG_NOT_FOUND",
  CONFIG_VALIDATION_ERROR: "CONFIG_VALIDATION_ERROR",
  PROJECT_NOT_VALID: "PROJECT_NOT_VALID",

  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
  MODULE_ALREADY_EXISTS: "MODULE_ALREADY_EXISTS",
  MODULE_INSTALL_FAILED: "MODULE_INSTALL_FAILED",
  MODULE_CONFIG_INVALID: "MODULE_CONFIG_INVALID",

  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  FILE_ALREADY_EXISTS: "FILE_ALREADY_EXISTS",
  FILE_OPERATION_ERROR: "FILE_OPERATION_ERROR",
  FILE_PERMISSION_ERROR: "FILE_PERMISSION_ERROR",
  FILE_MODIFICATION_FAILED: "FILE_MODIFICATION_FAILED",

  PKG_UNINSTALL_FAILED: "PKG_UNINSTALL_FAILED",
  PKG_MANAGER_EXECUTION_ERROR: "PKG_MANAGER_EXECUTION_ERROR",
  INVALID_PACKAGE_MANAGER: "INVALID_PACKAGE_MANAGER",

  PERMISSION_DENIED: "PERMISSION_DENIED",
  NETWORK_ERROR: "NETWORK_ERROR",
  USER_CANCELLED: "USER_CANCELLED",

  DISK_FULL: "DISK_FULL",
  ROLLBACK_FAILED: "ROLLBACK_FAILED",

  MODULE_UNINSTALL_FAILED: "MODULE_UNINSTALL_FAILED",
} as const;

export type LogicErrorCode =
  (typeof LogicErrorCodes)[keyof typeof LogicErrorCodes];

export const ErrorCodes = {
  ...CLIErrorCodes,
  ...LogicErrorCodes,
} as const;

export type ErrorCode = CLIErrorCode | LogicErrorCode;

export interface NodeError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
  dest?: string;
  port?: number;
  address?: string;
}

export interface FSError extends NodeError {
  code:
    | "ENOENT"
    | "EACCES"
    | "EEXIST"
    | "EISDIR"
    | "ENOTDIR"
    | "ENOSPC"
    | "EPERM";
  path: string;
  syscall: "open" | "read" | "write" | "unlink" | "mkdir" | "rmdir" | "stat";
}

export interface NetworkError extends NodeError {
  code:
    | "ECONNREFUSED"
    | "ECONNRESET"
    | "ETIMEDOUT"
    | "ENETUNREACH"
    | "ENOTFOUND";
  address?: string;
  port?: number;
}

export interface ExecError extends NodeError {
  killed?: boolean;
  signal?: NodeJS.Signals;
  cmd?: string;
  stdout?: string;
  stderr?: string;
}

export function isNodeError(error: unknown): error is NodeError {
  return error instanceof Error && "code" in error;
}

export function isFSError(error: unknown): error is FSError {
  return (
    isNodeError(error) &&
    [
      "ENOENT",
      "EACCES",
      "EEXIST",
      "EISDIR",
      "ENOTDIR",
      "ENOSPC",
      "EPERM",
    ].includes(error.code || "")
  );
}

export function isNetworkError(error: unknown): error is NetworkError {
  return (
    isNodeError(error) &&
    [
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENETUNREACH",
      "ENOTFOUND",
    ].includes(error.code || "")
  );
}

export function isExecError(error: unknown): error is ExecError {
  return (
    isNodeError(error) &&
    ("killed" in error || "signal" in error || "cmd" in error)
  );
}

export function mapNodeErrorToLogicError(
  nodeError: NodeError
): LogicErrorCode | null {
  const mapping: Record<string, LogicErrorCode> = {
    ENOENT: LogicErrorCodes.FILE_NOT_FOUND,
    EACCES: LogicErrorCodes.FILE_PERMISSION_ERROR,
    EPERM: LogicErrorCodes.PERMISSION_DENIED,
    ENOSPC: LogicErrorCodes.DISK_FULL,
    ECONNREFUSED: LogicErrorCodes.NETWORK_ERROR,
    ECONNRESET: LogicErrorCodes.NETWORK_ERROR,
    ETIMEDOUT: LogicErrorCodes.NETWORK_ERROR,
    ENETUNREACH: LogicErrorCodes.NETWORK_ERROR,
  };

  return mapping[nodeError.code || ""] || null;
}
