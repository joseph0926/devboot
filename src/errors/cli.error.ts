import { BaseError } from "./base.error";

export abstract class CLIError extends BaseError {
  abstract readonly exitCode: number;
  abstract readonly showHelp: boolean;

  constructor(message: string, context?: Record<string, any>, cause?: unknown) {
    super(message, context, cause);
  }
}
