import type { PackageJson } from "./file.type.js";

export type ProjectType = "next" | "vite" | "react" | "node";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface ProjectContext {
  projectPath: string;
  packageJson: PackageJson;
  packageManager: PackageManager;
  projectType: ProjectType;
  hasTypeScript: boolean;
}

export interface ProjectInfo extends ProjectContext {
  name: string;
  version: string;
  hasSrcDirectory: boolean;
  hasTestDirectory: boolean;
}

export interface InstallOptionsOnly {
  force?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

export interface InstallOptions extends ProjectContext, InstallOptionsOnly {}
