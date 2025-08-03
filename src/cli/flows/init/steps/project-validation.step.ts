import chalk from "chalk";
import { ProjectNotValidError } from "../../../../errors/logic/config.error";
import { PackageJson } from "../../../../types/file.type";
import { readPackageJson } from "../../../../utils/file";

export class ProjectValidationStep {
  static async validate(projectPath: string): Promise<PackageJson> {
    try {
      return await readPackageJson(projectPath);
    } catch (error) {
      throw new ProjectNotValidError("Not a Node.js project", {
        filePath: projectPath,
      });
    }
  }

  static showProjectCreationHints(): void {
    console.log(chalk.red("\n❌ Error: Not a Node.js project\n"));
    console.log("This command must be run in a directory with package.json");
    console.log("\nTo create a new project, try:");
    console.log(chalk.cyan("  npm init -y"));
    console.log(chalk.cyan("  pnpm create vite"));
    console.log(chalk.cyan("  npx create-next-app"));
  }
}
