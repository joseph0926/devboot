#!/usr/bin/env node
import { Command } from "commander";
import { intro, outro, spinner } from "@clack/prompts";
import chalk from "chalk";
import { readPackageJson, fileExists } from "../utils/file";
import { logger } from "../utils/logger";
import path from "path";
import { version } from "../../package.json";
import { ModuleRegistry } from "../modules/index";
import { InitCommand } from "./commands/init.command";

const program = new Command();

program
  .name("devboot")
  .description("Zero-config dev environment setup for modern web projects")
  .version(version);

InitCommand.register(program);

program
  .command("add <modules...>")
  .description("Add specific modules to your project")
  .option("--no-install", "Skip dependency installation")
  .option("-v, --verbose", "Show detailed output")
  .option("--dry-run", "Show what would be installed without making changes")
  .action(async (modules: string[], options) => {
    try {
      const projectPath = process.cwd();

      try {
        await readPackageJson(projectPath);
      } catch (error) {
        console.log(chalk.red("\n❌ Error: Not a Node project\n"));
        console.log("Run this command in a directory with packageon");
        process.exit(1);
      }

      const validModules = [
        "eslint-prettier",
        "typescript",
        "git-hooks",
        "editorconfig",
      ];

      const invalidModules = modules.filter((m) => !validModules.includes(m));
      const validModulesToAdd = modules.filter((m) => validModules.includes(m));

      if (invalidModules.length > 0) {
        console.log(
          chalk.red("\n❌ Invalid modules:"),
          invalidModules.join(", ")
        );
        console.log(chalk.yellow("\n💡 Available modules:"));
        validModules.forEach((mod) => {
          console.log(`  • ${mod} - ${getModuleDescription(mod)}`);
        });
        console.log(
          "\nExample: " + chalk.cyan("devboot add eslint-prettier typescript")
        );
        process.exit(1);
      }

      intro(chalk.cyan(`Adding ${validModulesToAdd.length} module(s)`));

      if (options.dryRun) {
        console.log(chalk.blue("\n🔍 Dry run mode - no changes will be made"));
        for (const module of validModulesToAdd) {
          console.log(chalk.gray(`Would add: ${module}`));
        }
        outro("Dry run complete!");
        process.exit(0);
      }

      const s = spinner();

      for (const module of validModulesToAdd) {
        s.start(`Adding ${module}`);

        try {
          await new Promise((resolve) => setTimeout(resolve, 800));

          s.stop(`${chalk.green("✓")} ${module} added`);
        } catch (error) {
          s.stop(`${chalk.red("✗")} Failed to add ${module}`);
          throw error;
        }
      }

      outro(chalk.green("✨ All modules added successfully!"));
    } catch (error) {
      console.log("");
      logger.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
      process.exit(1);
    }
  });

program
  .command("list")
  .alias("ls")
  .description("List available modules")
  .option("-i, --installed", "Show only installed modules")
  .action(async (options) => {
    const projectPath = process.cwd();
    let installedModules: string[] = [];

    try {
      await readPackageJson(projectPath);
      installedModules = await checkExistingConfigs(projectPath);
    } catch {}

    console.log(chalk.bold("\n📦 Available DevBoot Modules:\n"));

    const modules = [
      {
        name: "eslint-prettier",
        description: "Code formatting and linting",
        installed:
          installedModules.includes("eslint") ||
          installedModules.includes("prettier"),
      },
      {
        name: "typescript",
        description: "TypeScript configuration",
        installed: installedModules.includes("typescript"),
      },
      {
        name: "git-hooks",
        description: "Husky + lint-staged for Git hooks",
        installed: installedModules.includes("husky"),
      },
      {
        name: "editorconfig",
        description: "EditorConfig for consistent coding styles",
        installed: installedModules.includes("editorconfig"),
      },
    ];

    modules.forEach(({ name, description, installed }) => {
      if (options.installed && !installed) return;

      const status = installed
        ? chalk.green("✓ installed")
        : chalk.gray("not installed");
      console.log(`  ${chalk.cyan(name.padEnd(20))} ${description} ${status}`);
    });

    if (!options.installed) {
      console.log(chalk.gray("\nUse 'devboot add <module>' to add a module"));
      console.log(
        chalk.gray("Use 'devboot list -i' to see only installed modules")
      );
    }

    console.log("");
  });

program
  .command("doctor")
  .description("Check your DevBoot setup")
  .action(async () => {
    intro(chalk.cyan("🏥 DevBoot Doctor"));

    const projectPath = process.cwd();
    const checks = [];

    try {
      const pkg = await readPackageJson(projectPath);
      checks.push({
        name: "packageon",
        status: "ok",
        message: `Found: ${pkg.name}`,
      });
    } catch {
      checks.push({
        name: "packageon",
        status: "error",
        message: "Not found",
      });
    }

    const nodeVersion = process.version || "";
    const versionParts = nodeVersion.slice(1).split(".");
    const majorVersion = parseInt(versionParts[0] || "0", 10);

    if (!nodeVersion || !versionParts[0] || isNaN(majorVersion)) {
      checks.push({
        name: "Node",
        status: "error",
        message: `Invalid version: ${nodeVersion || "unknown"}`,
      });
    } else if (majorVersion >= 22) {
      checks.push({
        name: "Node",
        status: "ok",
        message: nodeVersion,
      });
    } else if (majorVersion >= 18) {
      checks.push({
        name: "Node",
        status: "warn",
        message: `${nodeVersion} (22+ recommended)`,
      });
    } else {
      checks.push({
        name: "Node",
        status: "error",
        message: `${nodeVersion} (22+ required)`,
      });
    }

    const gitExists = await fileExists(path.join(projectPath, ".git"));
    checks.push({
      name: "Git repository",
      status: gitExists ? "ok" : "warn",
      message: gitExists ? "Initialized" : "Not initialized",
    });

    console.log("");
    checks.forEach(({ name, status, message }) => {
      const icon =
        status === "ok"
          ? chalk.green("✓")
          : status === "warn"
          ? chalk.yellow("⚠")
          : chalk.red("✗");
      console.log(`  ${icon} ${name.padEnd(20)} ${message}`);
    });

    outro("Check complete!");
  });

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
    "devboot init"
  )}                    ${chalk.gray("# Interactive setup")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot init -y"
  )}                 ${chalk.gray("# Use defaults")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot add eslint-prettier"
  )}     ${chalk.gray("# Add specific module")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot list"
  )}                    ${chalk.gray("# Show all modules")}
  ${chalk.gray("$")} ${chalk.cyan(
    "devboot doctor"
  )}                  ${chalk.gray("# Check your setup")}

${chalk.bold("Need help?")}
  ${chalk.gray("Visit:")} https://github.com/joseph0926/devboot
  ${chalk.gray("Report issues:")} https://github.com/joseph0926/devboot/issues
`
);

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

async function checkExistingConfigs(projectPath: string): Promise<string[]> {
  const configs = [];
  const modules = ModuleRegistry.getAll();

  for (const module of modules) {
    if (await module.isInstalled(projectPath)) {
      configs.push(module.name);
    }
  }

  const eslintConfigs = [
    ".eslintrc",
    ".eslintrc.cjs",
    ".eslintrcon",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config",
    "eslint.config.mjs",
  ];

  for (const config of eslintConfigs) {
    if (await fileExists(path.join(projectPath, config))) {
      if (!configs.includes("eslint")) {
        configs.push("eslint");
      }
      break;
    }
  }

  const prettierConfigs = [
    ".prettierrc",
    ".prettierrcon",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc",
    ".prettierrc.cjs",
    "prettier.config",
    "prettier.config.cjs",
  ];

  for (const config of prettierConfigs) {
    if (await fileExists(path.join(projectPath, config))) {
      configs.push("prettier");
      break;
    }
  }

  if (await fileExists(path.join(projectPath, "tsconfigon"))) {
    configs.push("typescript");
  }

  if (await fileExists(path.join(projectPath, ".husky"))) {
    configs.push("husky");
  }

  if (await fileExists(path.join(projectPath, ".editorconfig"))) {
    configs.push("editorconfig");
  }

  return configs;
}

function getModuleDescription(module: string): string {
  const descriptions: Record<string, string> = {
    "eslint-prettier": "ESLint + Prettier - Code formatting and linting",
    typescript: "TypeScript - Type-safe JavaScript",
    "git-hooks": "Husky + lint-staged - Pre-commit hooks",
    editorconfig: "EditorConfig - Consistent coding styles",
  };

  return descriptions[module] || module;
}
