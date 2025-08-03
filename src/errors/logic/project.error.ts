import { LogicErrorCodes } from "../../types/error.type";
import { LogicError } from "../logic.error";

interface ProjectErrorContext {
  projectPath: string;
  hasPackageJson: boolean;
  searchedPath?: string;
  parseError?: string;
  suggestion?: string;
}

export class ProjectNotFoundError extends LogicError<ProjectErrorContext> {
  readonly code = LogicErrorCodes.PROJECT_NOT_FOUND;
  readonly isRecoverable = false;

  override get solution() {
    const { suggestion } = this.context || {};
    if (suggestion) {
      return `Run '${suggestion}' to initialize a new project.`;
    }
    return "Please run this command from a project root with a package.json file.";
  }
}

export class ProjectInvalidError extends LogicError<ProjectErrorContext> {
  readonly code = LogicErrorCodes.PROJECT_INVALID;
  readonly isRecoverable = false;

  override get solution() {
    const { parseError } = this.context || {};
    if (parseError) {
      return `Fix JSON syntax error: ${parseError}`;
    }
    return "Please ensure package.json is valid JSON format.";
  }
}
