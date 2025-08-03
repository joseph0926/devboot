import { Command } from "commander";
import { InitFlow } from "../flows/init/init.flow";
import { CLIErrorHandler } from "../../errors/cli/cli-error-handler";

export class InitCommand {
  static register(program: Command) {
    program
      .command("init")
      .description("Initialize DevBoot in your project")
      .option("-y, --yes", "Skip all prompts and use defaults")
      .option("-v, --verbose", "Show detailed output")
      .option(
        "--dry-run",
        "Show what would be installed without making changes"
      )
      .option("-f, --force", "Overwrite existing configurations")
      .action(async (options) => {
        try {
          const flow = new InitFlow(options);
          await flow.execute();
        } catch (error) {
          CLIErrorHandler.handle(error, {
            verbose: options.verbose,
            showHelp: false,
          });
        }
      });
  }
}
