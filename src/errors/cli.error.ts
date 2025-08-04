import { CLIErrorCode } from "../types/error.type";
import { BaseError } from "./base.error";

export abstract class CLIError<TContext = unknown> extends BaseError<
  CLIErrorCode,
  TContext
> {
  abstract readonly exitCode: number;
  abstract readonly showHelp: boolean;
}

export class SimpleCLIError extends CLIError {
  constructor(
    public readonly code: CLIErrorCode,
    message: string,
    public readonly isRecoverable: boolean = true,
    public readonly exitCode: number,
    public readonly showHelp: boolean = true,
    context?: Record<string, any>,
  ) {
    super(message, context);
  }
}
