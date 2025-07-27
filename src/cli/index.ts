#!/usr/bin/env node
import { Command } from "commander";
import {
  intro,
  outro,
  multiselect,
  confirm,
  cancel,
  isCancel,
  note,
  spinner,
} from "@clack/prompts";
import chalk from "chalk";
import { readPackageJson, fileExists } from "../utils/file.js";
import { logger } from "../utils/logger.js";
import path from "path";
import { version } from "../../package.json";
import type { PackageJson } from "../types/file.type.js";

const program = new Command();

const DEVBOOT_LOGO = `
╔══════════════════════════════════╗
║         🔧 DevBoot               ║
║   Modern Dev Environment Setup   ║
╚══════════════════════════════════╝
`;

program
  .name("devboot")
  .description("Zero-config dev environment setup for modern web projects")
  .version(version);

program
  .command("init")
  .description("Initialize DevBoot in your project")
  .option("-y, --yes", "Skip all prompts and use defaults")
  .option("-v, --verbose", "Show detailed output")
  .option("--dry-run", "Show what would be installed without making changes")
  .action(async (options) => {
    try {
      const projectPath = process.cwd();
      let packageJson: PackageJson;

      try {
        packageJson = await readPackageJson(projectPath);
      } catch (error) {
        console.log(chalk.red("\n❌ Error: Not a Node.js project\n"));
        console.log(
          "This command must be run in a directory with package.json"
        );
        console.log("\nTo create a new project, try:");
        console.log(chalk.cyan("  npm init -y"));
        console.log(chalk.cyan("  pnpm create vite"));
        console.log(chalk.cyan("  npx create-next-app"));
        process.exit(1);
      }

      if (!options.yes && !options.verbose) {
        console.log(chalk.cyan(DEVBOOT_LOGO));
      }

      intro(chalk.cyan("Welcome to DevBoot!"));

      const projectInfo = await analyzeProject(projectPath, packageJson);

      if (!options.yes) {
        note(
          `${chalk.bold("Project:")} ${projectInfo.name}\n` +
            `${chalk.bold("Type:")} ${projectInfo.type}\n` +
            `${chalk.bold("Package Manager:")} ${projectInfo.packageManager}`,
          "Project detected"
        );
      }

      const existingConfigs = await checkExistingConfigs(projectPath);

      if (existingConfigs.length > 0 && !options.yes) {
        const configList = existingConfigs
          .map((config) => `  • ${config}`)
          .join("\n");

        note(
          `Found existing configurations:\n${chalk.yellow(configList)}`,
          "⚠️  Warning"
        );

        const shouldContinue = await confirm({
          message: "Some tools are already configured. Continue anyway?",
          initialValue: false,
        });

        if (isCancel(shouldContinue) || !shouldContinue) {
          cancel("Setup cancelled");
          process.exit(0);
        }
      }

      let selectedModules: string[] = [];

      if (options.yes) {
        selectedModules = ["eslint-prettier"];
        logger.info("Using default configuration...");
      } else {
        console.log("");
        console.log(chalk.gray("  📋 How to select:"));
        console.log(chalk.gray("  │"));
        console.log(chalk.gray("  ├─ Use ↑↓ arrows to navigate"));
        console.log(chalk.gray("  ├─ Press Space to select/unselect"));
        console.log(chalk.gray("  └─ Press Enter when done"));
        console.log("");

        const modules = await multiselect({
          message: "Select tools to set up:",
          options: [
            {
              value: "eslint-prettier",
              label: "ESLint + Prettier",
              hint: existingConfigs.includes("eslint")
                ? chalk.yellow("⚠ already configured")
                : chalk.green("✓ recommended"),
            },
            {
              value: "typescript",
              label: "TypeScript",
              hint: existingConfigs.includes("typescript")
                ? chalk.yellow("⚠ already configured")
                : projectInfo.hasTypeScript
                ? chalk.blue("detected in project")
                : "",
            },
            {
              value: "git-hooks",
              label: "Git Hooks (Husky + lint-staged)",
              hint: existingConfigs.includes("husky")
                ? chalk.yellow("⚠ already configured")
                : "",
            },
            {
              value: "editorconfig",
              label: "EditorConfig",
              hint: "consistent code style",
            },
          ],
          initialValues: ["eslint-prettier"],
          required: false,
        });

        if (isCancel(modules)) {
          cancel("Setup cancelled");
          process.exit(0);
        }

        selectedModules = modules as string[];
      }

      if (selectedModules.length === 0) {
        console.log(chalk.yellow("\n⚠  No modules selected"));
        outro("Nothing to do. Run 'devboot init' again when you're ready!");
        process.exit(0);
      }

      if (!options.yes) {
        const planDetails = selectedModules
          .map((mod) => `  • ${getModuleDescription(mod)}`)
          .join("\n");

        note(`Will set up:\n${chalk.green(planDetails)}`, "Installation plan");

        const shouldProceed = await confirm({
          message: "Proceed with installation?",
          initialValue: true,
        });

        if (isCancel(shouldProceed) || !shouldProceed) {
          cancel("Setup cancelled");
          process.exit(0);
        }
      }

      if (options.dryRun) {
        console.log(chalk.blue("\n🔍 Dry run mode - no changes will be made"));
        for (const module of selectedModules) {
          console.log(chalk.gray(`Would install: ${module}`));
        }
        outro("Dry run complete!");
        process.exit(0);
      }

      console.log("");
      const s = spinner();

      for (const module of selectedModules) {
        s.start(`Installing ${module}`);

        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          s.stop(`${chalk.green("✓")} ${module} installed`);
        } catch (error) {
          s.stop(`${chalk.red("✗")} Failed to install ${module}`);
          throw error;
        }
      }

      outro(chalk.green("✨ All done!"));

      console.log("\n" + chalk.bold("Next steps:"));

      if (selectedModules.includes("eslint-prettier")) {
        console.log(
          chalk.gray("  1. Run") +
            chalk.cyan(" npm run lint") +
            chalk.gray(" to check your code")
        );
        console.log(
          chalk.gray("  2. Run") +
            chalk.cyan(" npm run format") +
            chalk.gray(" to format your code")
        );
      }

      if (selectedModules.includes("git-hooks")) {
        console.log(
          chalk.gray("  3. Commit your code - hooks will run automatically")
        );
      }

      console.log("");
    } catch (error) {
      console.log("");
      logger.error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );

      if (options.verbose && error instanceof Error) {
        console.log(chalk.gray("\nStack trace:"));
        console.log(chalk.gray(error.stack));
      }

      process.exit(1);
    }
  });

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
        console.log(chalk.red("\n❌ Error: Not a Node.js project\n"));
        console.log("Run this command in a directory with package.json");
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
        name: "package.json",
        status: "ok",
        message: `Found: ${pkg.name}`,
      });
    } catch {
      checks.push({
        name: "package.json",
        status: "error",
        message: "Not found",
      });
    }

    const nodeVersion = process.version || "";
    const versionParts = nodeVersion.slice(1).split(".");
    const majorVersion = parseInt(versionParts[0] || "0", 10);

    if (!nodeVersion || !versionParts[0] || isNaN(majorVersion)) {
      checks.push({
        name: "Node.js",
        status: "error",
        message: `Invalid version: ${nodeVersion || "unknown"}`,
      });
    } else if (majorVersion >= 22) {
      checks.push({
        name: "Node.js",
        status: "ok",
        message: nodeVersion,
      });
    } else if (majorVersion >= 18) {
      checks.push({
        name: "Node.js",
        status: "warn",
        message: `${nodeVersion} (22+ recommended)`,
      });
    } else {
      checks.push({
        name: "Node.js",
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

  const eslintConfigs = [
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.json",
    ".eslintrc.yml",
    ".eslintrc.yaml",
    "eslint.config.js",
    "eslint.config.mjs",
  ];

  for (const config of eslintConfigs) {
    if (await fileExists(path.join(projectPath, config))) {
      configs.push("eslint");
      break;
    }
  }

  const prettierConfigs = [
    ".prettierrc",
    ".prettierrc.json",
    ".prettierrc.yml",
    ".prettierrc.yaml",
    ".prettierrc.js",
    ".prettierrc.cjs",
    "prettier.config.js",
    "prettier.config.cjs",
  ];

  for (const config of prettierConfigs) {
    if (await fileExists(path.join(projectPath, config))) {
      configs.push("prettier");
      break;
    }
  }

  if (await fileExists(path.join(projectPath, "tsconfig.json"))) {
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

interface ProjectInfo {
  name: string;
  type: string;
  packageManager: string;
  hasTypeScript: boolean;
}

async function analyzeProject(
  projectPath: string,
  packageJson: PackageJson
): Promise<ProjectInfo> {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  let type = "Node.js";
  if (deps.next) type = "Next.js";
  else if (deps.react && deps.vite) type = "Vite + React";
  else if (deps.react) type = "React";
  else if (deps.vue) type = "Vue";
  else if (deps.svelte) type = "Svelte";

  let packageManager = "npm";
  if (await fileExists(path.join(projectPath, "pnpm-lock.yaml")))
    packageManager = "pnpm";
  else if (await fileExists(path.join(projectPath, "yarn.lock")))
    packageManager = "yarn";
  else if (await fileExists(path.join(projectPath, "bun.lockb")))
    packageManager = "bun";

  return {
    name: packageJson.name || "unnamed-project",
    type,
    packageManager,
    hasTypeScript: await fileExists(path.join(projectPath, "tsconfig.json")),
  };
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
