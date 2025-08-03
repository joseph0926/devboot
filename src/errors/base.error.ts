export abstract class BaseError<
  TCode extends string = string,
  TContext = unknown
> extends Error {
  abstract readonly code: TCode;
  abstract readonly isRecoverable: boolean;

  constructor(
    message: string,
    public readonly context?: TContext,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
