export { ModuleRegistry } from "./modules/index.js";
export { BaseModule } from "./modules/base.module.js";
export { TypeScriptModule } from "./modules/typescript/index.js";
export { PrettierModule } from "./modules/prettier/index.js";
export { EditorConfigModule } from "./modules/editorconfig/index.js";
export { ProjectAnalyzer } from "./core/project-analyzer.js";
export { ConfigDetector } from "./core/config-detector.js";
export { ModuleInstaller } from "./core/installer.js";

export type {
  InstallOptions,
  ValidationResult,
  InstallResult,
} from "./modules/base.module.js";
export type { ProjectType } from "./types/project.type.js";
export type {
  DetectedConfig,
  ConfigCategories,
  DetailedConfigInfo,
} from "./types/config.type.js";
