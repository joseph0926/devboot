import fs from "fs-extra";
import path from "path";
import type { PackageJson } from "../types/file.type";

export async function readPackageJson(
  projectPath: string
): Promise<PackageJson> {
  const packageJsonPath = path.join(projectPath, "package.json");

  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error("package.json not found. Are you in a Node.js project?");
  }

  return await fs.readJson(packageJsonPath);
}

export async function writePackageJson(
  projectPath: string,
  content: any
): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");
  await fs.writeJson(packageJsonPath, content, { spaces: 2 });
}

export async function fileExists(filePath: string): Promise<boolean> {
  return await fs.pathExists(filePath);
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await fs.ensureFile(filePath);
  await fs.writeFile(filePath, content);
}
