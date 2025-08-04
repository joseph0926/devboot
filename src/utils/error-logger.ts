import chalk from "chalk";
import { BaseError } from "../errors/base.error";
import { LogicError } from "../errors/logic.error";

export class ErrorLogger {
  private static readonly ERROR_PREFIX = {
    error: chalk.red("✗"),
    warning: chalk.yellow("⚠"),
    info: chalk.blue("ℹ"),
  };

  static logError(
    error: unknown,
    options: {
      verbose?: boolean;
      prefix?: boolean;
      showSolution?: boolean;
      showContext?: boolean;
    } = {},
  ): void {
    const {
      verbose = false,
      prefix = true,
      showSolution = true,
      showContext = false,
    } = options;

    if (error instanceof BaseError) {
      this.logBaseError(error, { verbose, prefix, showSolution, showContext });
    } else if (error instanceof Error) {
      this.logGenericError(error, { verbose, prefix });
    } else {
      this.logUnknownError(error, { prefix });
    }
  }

  private static logBaseError(
    error: BaseError,
    options: {
      verbose: boolean;
      prefix: boolean;
      showSolution: boolean;
      showContext: boolean;
    },
  ): void {
    const prefix = options.prefix ? `${this.ERROR_PREFIX.error} ` : "";

    console.error(`${prefix}${error.message}`);

    if (options.showSolution && error instanceof LogicError && error.solution) {
      console.log(chalk.yellow(`\n💡 ${error.solution}`));
    }

    if (
      options.showContext &&
      error.context &&
      (options.verbose || process.env.DEBUG)
    ) {
      console.log(chalk.gray("\nDebug info:"));
      console.log(chalk.gray(JSON.stringify(error.context, null, 2)));
    }

    if (options.verbose && error.stack) {
      console.log(chalk.gray("\nStack trace:"));
      console.log(chalk.gray(error.stack));
    }
  }

  private static logGenericError(
    error: Error,
    options: { verbose: boolean; prefix: boolean },
  ): void {
    const prefix = options.prefix ? `${this.ERROR_PREFIX.error} ` : "";
    console.error(`${prefix}${error.message}`);

    if (options.verbose && error.stack) {
      console.log(chalk.gray("\nStack trace:"));
      console.log(chalk.gray(error.stack));
    }
  }

  private static logUnknownError(
    error: unknown,
    options: { prefix: boolean },
  ): void {
    const prefix = options.prefix ? `${this.ERROR_PREFIX.error} ` : "";
    console.error(`${prefix}An unexpected error occurred`);
    console.error(chalk.gray(String(error)));
  }

  static logWarning(message: string): void {
    console.warn(`${this.ERROR_PREFIX.warning} ${message}`);
  }

  static logInfo(message: string): void {
    console.log(`${this.ERROR_PREFIX.info} ${message}`);
  }

  static logErrorSummary(errors: BaseError[]): void {
    if (errors.length === 0) return;

    const countText = `${errors.length} error${
      errors.length === 1 ? "" : "s"
    } occurred:`;
    console.error(chalk.red(`\n⚠️  ${countText}`));

    errors.forEach((error, index) => {
      console.error(chalk.red(`  ${index + 1}. ${error.message}`));

      if (error instanceof LogicError && error.solution) {
        console.log(chalk.yellow(`     💡 ${error.solution}`));
      }
    });
  }

  static logErrorWithProgress(
    error: BaseError,
    progress: { current: number; total: number; item: string },
  ): void {
    const progressInfo = chalk.gray(
      `[${progress.current}/${progress.total}] ${progress.item}`,
    );

    console.error(`${this.ERROR_PREFIX.error} ${progressInfo}`);
    this.logError(error, { prefix: false });
  }
}
