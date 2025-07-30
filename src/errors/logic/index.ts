import { SimpleLogicError } from "../logic.error";
import { LogicErrorDef, LogicErrorDefs } from "./error-definitions";

function createLogicError(errorDef: LogicErrorDef): SimpleLogicError {
  return new SimpleLogicError(
    errorDef.code,
    errorDef.message,
    errorDef.isRecoverable,
    errorDef.context,
    errorDef.solution
  );
}

export const LogicErrors = {
  projectNotFound: (path: string) =>
    createLogicError(LogicErrorDefs.projectNotFound(path)),

  projectInvalid: (path: string, reason: string) =>
    createLogicError(LogicErrorDefs.projectInvalid(path, reason)),

  packageManagerNotFound: (manager?: string) =>
    createLogicError(LogicErrorDefs.packageManagerNotFound(manager)),

  packageInstallFailed: (
    packages: string[],
    manager: string,
    exitCode: number
  ) =>
    createLogicError(
      LogicErrorDefs.packageInstallFailed(packages, manager, exitCode)
    ),

  configParseError: (file: string, error: unknown) =>
    createLogicError(LogicErrorDefs.configParseError(file, error)),

  configExists: (tool: string, file: string) =>
    createLogicError(LogicErrorDefs.configExists(tool, file)),
};

export { ConfigConflictError } from "./config-conflict.error";
