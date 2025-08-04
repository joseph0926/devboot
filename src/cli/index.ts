#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { version } from "../../package.json";
import { InitCommand } from "./commands/init.command";
import { AddCommand } from "./commands/add.command";
import { ListCommand } from "./commands/list.command";
import { DoctorCommand } from "./commands/doctor.command";
import { CLIErrorHandler } from "../errors/cli/cli-error-handler";
import { ExitCodes } from "../types/exit-codes";

CLIErrorHandler.setupExitHandlers();

const program = new Command();

program
  .name("devboot")
  .description("Zero-config dev environment setup for modern web projects")
  .version(version)
  .hook("preAction", (_thisCommand, actionCommand) => {
    const options = actionCommand.opts();
    if (options.verbose) {
      process.env.DEVBOOT_VERBOSE = "true";
    }
  });

InitCommand.register(program);
AddCommand.register(program);
ListCommand.register(program);
DoctorCommand.register(program);

program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) =>
    cmd.name() +
    " " +
    cmd
      .aliases()
      .map((a) => `(${a})`)
      .join(""),
});

program.addHelpText(
  "after",
  `
${chalk.bold("Examples:")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot init",
  )}                    ${chalk.gray("# Interactive setup")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot init -y",
  )}                 ${chalk.gray("# Use defaults")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot add eslint-prettier",
  )}     ${chalk.gray("# Add specific module")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot list",
  )}                    ${chalk.gray("# Show all modules")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot doctor",
  )}                  ${chalk.gray("# Check your setup")}

${chalk.bold("Need help?")}
  ${chalk.gray("Visit:")} https://github.com/joseph0926/devboot
  ${chalk.gray("Report issues:")} https://github.com/joseph0926/devboot/issues
`,
);

try {
  program.parse(process.argv);

  if (!process.argv.slice(2).length) {
    program.outputHelp();
    process.exit(ExitCodes.SUCCESS);
  }
} catch (error) {
  CLIErrorHandler.handle(error, {
    verbose: process.env.DEVBOOT_VERBOSE === "true",
    showHelp: true,
  });
}
