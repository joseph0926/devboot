import {
  BaseModule,
  type InstallOptions,
  type ValidationResult,
  type FileModifier,
} from "../base.module.js";
import { fileExists } from "../../utils/file.js";
import path from "path";

export class EditorConfigModule extends BaseModule {
  constructor() {
    super({
      name: "editorconfig",
      displayName: "EditorConfig",
      description: "Consistent coding styles across different editors",
      detectFiles: [".editorconfig"],
      conflicts: [],
    });
  }

  async isInstalled(projectPath: string): Promise<boolean> {
    return fileExists(path.join(projectPath, ".editorconfig"));
  }

  async validate(options: InstallOptions): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const isInstalled = await this.isInstalled(options.projectPath);

    if (isInstalled && !options.force) {
      result.valid = false;
      result.errors.push(
        ".editorconfig already exists. Use --force to overwrite."
      );
      return result;
    }

    if (isInstalled && options.force) {
      result.warnings.push("Existing .editorconfig will be overwritten");
    }

    return result;
  }

  async getDependencies(): Promise<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }> {
    return {};
  }

  async getFilesToCreate(
    options: InstallOptions
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const content = this.generateEditorConfig(options);
    files.set(".editorconfig", content);
    return files;
  }

  async getFilesToModify(): Promise<Map<string, FileModifier>> {
    return new Map();
  }

  async uninstall(
    options: InstallOptions
  ): Promise<import("../base.module.js").InstallResult> {
    const result: import("../base.module.js").InstallResult = {
      success: false,
      errors: [],
    };

    try {
      const configPath = path.join(options.projectPath, ".editorconfig");

      if (!(await fileExists(configPath))) {
        result.errors?.push(new Error(".editorconfig not found"));
        return result;
      }

      result.success = true;
      result.message = ".editorconfig removed successfully";
    } catch (error) {
      result.errors?.push(error as Error);
    }

    return result;
  }

  private generateEditorConfig(options: InstallOptions): string {
    const lines: string[] = [
      "# EditorConfig is awesome: https://EditorConfig.org",
      "",
      "root = true",
      "",
      "[*]",
      "charset = utf-8",
      "end_of_line = lf",
      "insert_final_newline = true",
      "trim_trailing_whitespace = true",
      "indent_style = space",
      "indent_size = 2",
      "",
    ];

    lines.push("[*.md]", "trim_trailing_whitespace = false", "");

    lines.push("[*.{json,yml,yaml}]", "indent_size = 2", "");

    if (["next", "vite", "react", "node"].includes(options.projectType)) {
      lines.push("[*.{js,jsx,mjs,cjs}]", "indent_size = 2", "");

      if (options.hasTypeScript) {
        lines.push("[*.{ts,tsx}]", "indent_size = 2", "");
      }
    }

    lines.push("[Makefile]", "indent_style = tab", "");

    const prettierConfig = options.packageJson.prettier;
    if (prettierConfig && typeof prettierConfig === "object") {
      if (
        "tabWidth" in prettierConfig &&
        typeof prettierConfig.tabWidth === "number"
      ) {
        const content = lines.join("\n");
        return content.replace(
          /indent_size = \d+/g,
          `indent_size = ${prettierConfig.tabWidth}`
        );
      }
    }

    return lines.join("\n");
  }
}
