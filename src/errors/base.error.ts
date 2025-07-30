export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly isRecoverable: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      isRecoverable: this.isRecoverable,
      stack: this.stack,
    };
  }
}
