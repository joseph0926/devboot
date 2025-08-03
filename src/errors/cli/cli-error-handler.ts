import chalk from "chalk";
import { BaseError } from "../../errors/base.error";
import { LogicError } from "../../errors/logic.error";
import { CLIError } from "../../errors/cli.error";
import {
  isNodeError,
  isFSError,
  isNetworkError,
  mapNodeErrorToLogicError,
  NodeError,
  FSError,
  NetworkError,
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
    options: ErrorHandlerOptions = {}
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
    options: { verbose: boolean; showHelp: boolean }
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showSolution: true,
    });

    if (error.showHelp || options.showHelp) {
      console.log("");
      console.log(chalk.gray("도움말을 보려면 다음 명령어를 실행하세요:"));
      console.log(chalk.cyan("  devboot --help"));
    }

    return error.exitCode;
  }

  /**
   * Logic 에러 처리
   */
  private static handleLogicError(
    error: LogicError,
    options: { verbose: boolean }
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showSolution: true,
      showContext: options.verbose,
    });

    return getExitCodeFromError(error.code);
  }

  /**
   * Base 에러 처리
   */
  private static handleBaseError(
    error: BaseError,
    options: { verbose: boolean }
  ): ExitCodes {
    ErrorLogger.logError(error, {
      verbose: options.verbose,
      showContext: options.verbose,
    });

    return getExitCodeFromError(error.code);
  }

  /**
   * Node.js 시스템 에러 처리
   */
  private static handleNodeError(
    error: NodeError,
    options: { verbose: boolean }
  ): ExitCodes {
    const friendlyMessage = this.getNodeErrorMessage(error);
    console.error(`${chalk.red("✗")} ${friendlyMessage}`);

    if (isFSError(error)) {
      console.log(chalk.yellow(`\n💡 파일 경로: ${error.path}`));

      if (error.code === "EACCES" || error.code === "EPERM") {
        console.log(chalk.yellow("💡 관리자 권한이 필요할 수 있습니다 (sudo)"));
      }
    }

    if (isNetworkError(error)) {
      console.log(chalk.yellow("\n💡 인터넷 연결을 확인해주세요"));
    }

    if (options.verbose) {
      console.log(chalk.gray("\n시스템 에러 정보:"));
      console.log(chalk.gray(`  코드: ${error.code}`));
      console.log(chalk.gray(`  시스템 콜: ${error.syscall}`));
      if (error.path) console.log(chalk.gray(`  경로: ${error.path}`));
    }

    const logicErrorCode = mapNodeErrorToLogicError(error);
    return logicErrorCode
      ? getExitCodeFromError(logicErrorCode)
      : ExitCodes.GENERAL_ERROR;
  }

  /**
   * 일반 Error 처리
   */
  private static handleGenericError(
    error: Error,
    options: { verbose: boolean }
  ): ExitCodes {
    ErrorLogger.logError(error, { verbose: options.verbose });
    return ExitCodes.GENERAL_ERROR;
  }

  /**
   * 알 수 없는 에러 처리
   */
  private static handleUnknownError(
    error: unknown,
    options: { verbose: boolean }
  ): ExitCodes {
    console.error(`${chalk.red("✗")} 예상치 못한 오류가 발생했습니다`);

    if (options.verbose) {
      console.log(chalk.gray("\n에러 정보:"));
      console.log(chalk.gray(String(error)));
    }

    return ExitCodes.UNKNOWN_ERROR;
  }

  /**
   * Node 에러를 사용자 친화적 메시지로 변환
   */
  private static getNodeErrorMessage(error: NodeError): string {
    const messages: Record<string, string> = {
      ENOENT: "파일 또는 디렉토리를 찾을 수 없습니다",
      EACCES: "파일 접근 권한이 없습니다",
      EPERM: "작업이 허용되지 않습니다",
      EEXIST: "파일이 이미 존재합니다",
      EISDIR: "디렉토리에 대한 작업은 허용되지 않습니다",
      ENOTDIR: "디렉토리가 아닙니다",
      ENOSPC: "디스크 공간이 부족합니다",
      ECONNREFUSED: "연결이 거부되었습니다",
      ECONNRESET: "연결이 재설정되었습니다",
      ETIMEDOUT: "연결 시간이 초과되었습니다",
      ENETUNREACH: "네트워크에 연결할 수 없습니다",
      ENOTFOUND: "도메인을 찾을 수 없습니다",
    };

    return messages[error.code || ""] || error.message;
  }

  /**
   * 여러 에러를 한 번에 처리
   */
  static handleMultiple(
    errors: BaseError[],
    options: ErrorHandlerOptions = {}
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
   * 프로세스 종료 시 정리 작업
   */
  static setupExitHandlers(): void {
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\n작업이 사용자에 의해 중단되었습니다"));
      process.exit(ExitCodes.USER_CANCELLED);
    });

    process.on("SIGTERM", () => {
      console.log(chalk.yellow("\n\n프로세스가 종료되었습니다"));
      process.exit(ExitCodes.PROCESS_ERROR);
    });

    process.on("unhandledRejection", (error) => {
      console.error(chalk.red("\n처리되지 않은 Promise 에러:"));
      this.handle(error, { verbose: true });
    });

    process.on("uncaughtException", (error) => {
      console.error(chalk.red("\n처리되지 않은 예외:"));
      this.handle(error, { verbose: true });
    });
  }
}
