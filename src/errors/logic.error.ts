import { ErrorCode } from "../types/error.type";
import { BaseError } from "./base.error";

export abstract class LogicError extends BaseError {
  abstract readonly code: ErrorCode;
  abstract readonly isRecoverable: boolean;

  constructor(message: string, context?: Record<string, any>, cause?: unknown) {
    super(message, context, cause);
  }

  get solution(): string | undefined {
    return undefined;
  }
}

export class SimpleLogicError extends LogicError {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly isRecoverable: boolean = true,
    context?: Record<string, any>,
    private readonly _solution?: string
  ) {
    super(message, context);
  }

  get solution() {
    return this._solution;
  }
}
