import chalk from "chalk";
import { BaseError } from "../../errors/base.error";
import { LogicError } from "../../errors/logic.error";
import { CLIError } from "../../errors/cli.error";
import {
  isNodeError,
  mapNodeErrorToLogicError,
  NodeError,
} from "../../types/error.type";
import { ExitCodes, getExitCodeFromError } from "../../types/exit-codes";
import { ErrorLogger } from "../../utils/error-logger";

export interface ErrorHandlerOptions {
  verbose?: boolean;
  showHelp?: boolean;
  exitOnError?: boolean;
}

export class CLIErrorHandler {
  static handle(
    error: unknown,
    options: ErrorHandlerOptions = {},
  ): never | void {
    const { verbose = false, showHelp = false, exitOnError = true } = options;

    let exitCode = ExitCodes.GENERAL_ERROR;

    if (error instanceof CLIError) {
      exitCode = this.handleCLIError(error, { verbose, showHelp });
    } else if (error instanceof LogicError) {
      exitCode = this.handleLogicError(error, { verbose });
    } else if (error instanceof BaseError) {
      exitCode = this.handleBaseError(error, { verbose });
    } else if (isNodeError(error)) {
      exitCode = this.handleNodeError(error, { verbose });
    } else if (error instanceof Error) {
      exitCode = this.handleGenericError(error, { verbose });
    } else {
      exitCode = this.handleUnknownError(error, { verbose });
    }

    if (exitOnError) {
      process.exit(exitCode);
    }
  }

  private static handleCLIError(
    error: CLIError,
    options: { verbose: boolean; showHelp: boolean },
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showSolution: true,
    });

    if (error.showHelp || options.showHelp) {
      console.log("");
      console.log(chalk.gray("For help, run the following command:"));
      console.log(chalk.cyan("  devboot --help"));
    }

    return error.exitCode;
  }

  /**
   * Logic error handling
   */
  private static handleLogicError(
    error: LogicError,
    options: { verbose: boolean },
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showSolution: true,
      showContext: options.verbose,
    });

    return getExitCodeFromError(error.code);
  }

  /**
   * Base error handling
   */
  private static handleBaseError(
    error: BaseError,
    options: { verbose: boolean },
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showContext: options.verbose,
    });

    return getExitCodeFromError(error.code);
  }

  /**
   * Node.js system error handling
   */
  private static handleNodeError(
    error: NodeError,
    options: { verbose: boolean },
  ): ExitCodes {
    const friendlyMessage = this.getNodeErrorMessage(error);
    console.error(`${chalk.red("✗")} ${friendlyMessage}`);

    if (error.code === "ENOENT" || error.code === "EACCES" || error.code === "EPERM") {
      if ("path" in error) {
        console.log(chalk.yellow(`\n💡 File path: ${error.path}`));
      }

      if (error.code === "EACCES" || error.code === "EPERM") {
        console.log(chalk.yellow("💡 Administrator privileges may be required (sudo)"));
      }
    }

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.log(chalk.yellow("\n💡 Please check your internet connection"));
    }

    if (options.verbose) {
      console.log(chalk.gray("\nSystem error info:"));
      console.log(chalk.gray(`  Code: ${error.code}`));
      console.log(chalk.gray(`  System call: ${error.syscall}`));
      if (error.path) console.log(chalk.gray(`  Path: ${error.path}`));
    }

    const logicErrorCode = mapNodeErrorToLogicError(error);
    return logicErrorCode
      ? getExitCodeFromError(logicErrorCode)
      : ExitCodes.GENERAL_ERROR;
  }

  /**
   * Generic Error handling
   */
  private static handleGenericError(
    error: Error,
    options: { verbose: boolean },
  ): ExitCodes {
    ErrorLogger.logError(error, { verbose: options.verbose });
    return ExitCodes.GENERAL_ERROR;
  }

  /**
   * Unknown error handling
   */
  private static handleUnknownError(
    error: unknown,
    options: { verbose: boolean },
  ): ExitCodes {
    console.error(`${chalk.red("✗")} An unexpected error occurred`);

    if (options.verbose) {
      console.log(chalk.gray("\nError info:"));
      console.log(chalk.gray(String(error)));
    }

    return ExitCodes.UNKNOWN_ERROR;
  }

  /**
   * Convert Node errors to user-friendly messages
   */
  private static getNodeErrorMessage(error: NodeError): string {
    const messages: Record<string, string> = {
      ENOENT: "File or directory not found",
      EACCES: "File access permission denied",
      EPERM: "Operation not permitted",
      EEXIST: "File already exists",
      EISDIR: "Operation on directory not allowed",
      ENOTDIR: "Not a directory",
      ENOSPC: "Insufficient disk space",
      ECONNREFUSED: "Connection refused",
      ECONNRESET: "Connection reset",
      ETIMEDOUT: "Connection timed out",
      ENETUNREACH: "Network unreachable",
      ENOTFOUND: "Domain not found",
    };

    return messages[error.code || ""] || error.message;
  }

  /**
   * Handle multiple errors at once
   */
  static handleMultiple(
    errors: BaseError[],
    options: ErrorHandlerOptions = {},
  ): never | void {
    if (errors.length === 0) return;

    ErrorLogger.logErrorSummary(errors);

    let maxExitCode = ExitCodes.GENERAL_ERROR;

    for (const error of errors) {
      const code = getExitCodeFromError(error.code);
      if (code > maxExitCode) {
        maxExitCode = code;
      }
    }

    if (options.exitOnError) {
      process.exit(maxExitCode);
    }
  }

  /**
   * Cleanup tasks when process exits
   */
  static setupExitHandlers(): void {
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\nOperation cancelled by user"));
      process.exit(ExitCodes.USER_CANCELLED);
    });

    process.on("SIGTERM", () => {
      console.log(chalk.yellow("\n\nProcess terminated"));
      process.exit(ExitCodes.PROCESS_ERROR);
    });

    process.on("unhandledRejection", (error) => {
      console.error(chalk.red("\nUnhandled Promise rejection:"));
      this.handle(error, { verbose: true });
    });

    process.on("uncaughtException", (error) => {
      console.error(chalk.red("\nUncaught exception:"));
      this.handle(error, { verbose: true });
    });
  }
}
