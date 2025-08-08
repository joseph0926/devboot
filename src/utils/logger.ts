import chalk from "chalk";
import ora, { Ora } from "ora";

export class Logger {
  private verboseMode: boolean;

  constructor(verbose = false) {
    this.verboseMode = verbose;
  }

  info(message: string) {
    console.log(chalk.blue("ℹ"), message);
  }

  success(message: string) {
    console.log(chalk.green("✓"), message);
  }

  error(message: string) {
    console.log(chalk.red("✗"), message);
  }

  warn(message: string) {
    console.log(chalk.yellow("⚠"), message);
  }

  debug(message: string) {
    if (this.verboseMode) {
      console.log(chalk.gray("○"), message);
    }
  }

  log(message: string) {
    console.log(message);
  }

  plain(message: string) {
    console.log(message);
  }

  gray(message: string) {
    console.log(chalk.gray(message));
  }

  cyan(message: string) {
    console.log(chalk.cyan(message));
  }

  bold(message: string) {
    console.log(chalk.bold(message));
  }

  yellow(message: string) {
    console.log(chalk.yellow(message));
  }

  red(message: string) {
    console.log(chalk.red(message));
  }

  newline() {
    console.log("");
  }

  spinner(text: string): Ora {
    return ora({
      text,
      spinner: "dots",
      color: "blue",
    });
  }
}

export const logger = new Logger();
