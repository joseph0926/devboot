import { Command } from "commander";
import { AddFlow } from "../flows/add/add.flow";
import { ModuleInstaller } from "../../core/installer";
import { CLIErrorHandler } from "../../errors/cli/cli-error-handler";

export class AddCommand {
  static register(program: Command): void {
    program
      .command("add <modules...>")
      .description("Add specific modules to your project")
      .option("--no-install", "Skip dependency installation")
      .option("-v, --verbose", "Show detailed output")
      .option(
        "--dry-run",
        "Show what would be installed without making changes"
      )
      .action(async (modules: string[], options) => {
        try {
          const moduleInstaller = new ModuleInstaller();
          const addFlow = new AddFlow(moduleInstaller);

          await addFlow.execute({
            modules,
            noInstall: !options.install,
            verbose: options.verbose || false,
            dryRun: options.dryRun || false,
          });
        } catch (error) {
          CLIErrorHandler.handle(error, {
            verbose: options.verbose,
            showHelp: true,
          });
        }
      });
  }
}
