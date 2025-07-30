import { ErrorCodes } from "../../types/error.type";

export const LogicErrorDefs = {
  projectNotFound: (path: string) => ({
    code: ErrorCodes.PROJECT_NOT_FOUND,
    message: `No package.json found in ${path}`,
    isRecoverable: false,
    context: { path },
    solution:
      "Run this command in a Node.js project directory with package.json",
  }),

  projectInvalid: (path: string, reason: string) => ({
    code: ErrorCodes.PROJECT_INVALID,
    message: `Invalid project structure: ${reason}`,
    isRecoverable: false,
    context: { path, reason },
    solution: "Ensure the project has a valid Node.js structure",
  }),

  packageManagerNotFound: (manager?: string) => ({
    code: ErrorCodes.PKG_MANAGER_NOT_FOUND,
    message: manager
      ? `Package manager '${manager}' is not installed or not in PATH`
      : "No package manager detected (npm, yarn, or pnpm)",
    isRecoverable: true,
    context: { manager },
    solution: manager
      ? `Install ${manager}: npm install -g ${manager}`
      : "Install a package manager (npm, yarn, or pnpm)",
  }),

  packageInstallFailed: (
    packages: string[],
    manager: string,
    exitCode: number
  ) => ({
    code: ErrorCodes.PKG_INSTALL_FAILED,
    message: `Failed to install packages: ${packages.join(", ")}`,
    isRecoverable: true,
    context: { packages, manager, exitCode },
    solution: `Try running '${manager} install' manually or check your internet connection`,
  }),

  configParseError: (file: string, error: unknown) => ({
    code: ErrorCodes.CONFIG_PARSE_ERROR,
    message: `Failed to parse ${file}: ${
      error instanceof Error ? error.message : "Unknown error"
    }`,
    isRecoverable: true,
    context: { file, parseError: error },
    solution: `Check the syntax of ${file} or backup and recreate it`,
  }),

  configExists: (tool: string, file: string) => ({
    code: ErrorCodes.CONFIG_CONFLICT,
    message: `${tool} configuration already exists: ${file}`,
    isRecoverable: true,
    context: { tool, file },
    solution: `Remove ${file} or use --force to override`,
  }),
} as const;

export type LogicErrorDef = ReturnType<
  (typeof LogicErrorDefs)[keyof typeof LogicErrorDefs]
>;
