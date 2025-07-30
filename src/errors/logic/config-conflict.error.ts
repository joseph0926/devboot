import { ErrorCodes } from "../../types/error.type";
import { LogicError } from "../logic.error";

export class ConfigConflictError extends LogicError {
  readonly code = ErrorCodes.CONFIG_CONFLICT;
  readonly isRecoverable = true;

  constructor(
    private tool: string,
    private conflicts: {
      existing: string[];
      attempted?: string;
      format?: "json" | "js" | "yaml";
    }
  ) {
    const message =
      conflicts.existing.length > 1
        ? `Multiple ${tool} configuration files found`
        : `${tool} configuration conflict`;

    super(message, { tool, ...conflicts });
  }

  get solution(): string {
    const { existing, attempted } = this.conflicts;

    if (existing.length > 1) {
      return [
        `Found multiple ${this.tool} configs:`,
        ...existing.map((f) => `  - ${f}`),
        "",
        "Keep only one configuration file and remove the others",
      ].join("\n");
    }

    if (attempted && this.conflicts.format) {
      return [
        `Cannot create ${attempted} because ${existing[0]} already exists.`,
        "Options:",
        `  1. Use existing ${existing[0]}`,
        `  2. Remove ${existing[0]} and run again`,
        `  3. Use --force to override`,
        `  4. Use --format ${this.conflicts.format} to keep the same format`,
      ].join("\n");
    }

    return `Remove ${existing[0]} or use --force to override`;
  }

  static multipleConfigs(tool: string, files: string[]) {
    return new ConfigConflictError(tool, { existing: files });
  }

  static formatConflict(
    tool: string,
    existing: string,
    attempted: string,
    format: "json" | "js" | "yaml"
  ) {
    return new ConfigConflictError(tool, {
      existing: [existing],
      attempted,
      format,
    });
  }
}
