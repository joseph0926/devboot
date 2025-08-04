import { LogicErrorCode } from "../types/error.type";
import { BaseError } from "./base.error";

export abstract class LogicError<TContext = unknown> extends BaseError<
  LogicErrorCode,
  TContext
> {
  get solution(): string | undefined {
    return undefined;
  }
}

export class SimpleLogicError extends LogicError {
  constructor(
    public readonly code: LogicErrorCode,
    message: string,
    public readonly isRecoverable: boolean = true,
    context?: Record<string, any>,
    private readonly _solution?: string,
  ) {
    super(message, context);
  }

  get solution() {
    return this._solution;
  }
}
