import * as prompts from "@clack/prompts";
import chalk from "chalk";
import {
  EditorConfigSection,
  EditorConfigRule,
  FILE_TYPE_RECOMMENDATIONS,
  RULE_OPTIONS,
} from "./rules.js";
import type { ProjectContext } from "../../types/project.type.js";

export class EditorConfigBuilder {
  private sections: EditorConfigSection[] = [];
  private globalRules: EditorConfigRule[] = [];

  async build(context: ProjectContext): Promise<string> {
    prompts.intro(chalk.blue("🔧 EditorConfig Interactive Setup"));

    await this.setupGlobalRules();

    await this.setupFileTypeRules(context);

    await this.setupCustomRules();

    const preview = this.generatePreview();
    prompts.log.message("");
    prompts.log.info("📄 Generated Configuration Preview:");
    prompts.log.message(chalk.gray(preview));

    const confirmed = await prompts.confirm({
      message: "Apply this configuration?",
      initialValue: true,
    });

    if (!confirmed || prompts.isCancel(confirmed)) {
      prompts.cancel("Configuration cancelled");
      throw new Error("Configuration cancelled");
    }

    prompts.outro(chalk.green("✅ EditorConfig setup complete!"));

    return this.generate();
  }

  private async setupGlobalRules(): Promise<void> {
    prompts.log.step(chalk.cyan("Global Rules Configuration"));
    prompts.log.message("These rules will apply to all files by default\n");

    const charset = await prompts.select({
      message: "Character encoding",
      options: RULE_OPTIONS.charset,
    });

    if (prompts.isCancel(charset)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    this.globalRules.push({ key: "charset", value: charset });

    const eol = await prompts.select({
      message: "Line ending style",
      options: RULE_OPTIONS.end_of_line,
    });

    if (prompts.isCancel(eol)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    this.globalRules.push({ key: "end_of_line", value: eol });

    const indentStyle = await prompts.select({
      message: "Indentation style",
      options: RULE_OPTIONS.indent_style,
    });

    if (prompts.isCancel(indentStyle)) {
      prompts.cancel("Setup cancelled");
      throw new Error("Cancelled");
    }

    this.globalRules.push({ key: "indent_style", value: indentStyle });

    if (indentStyle === "space") {
      const indentSize = await prompts.select({
        message: "Indentation size",
        options: RULE_OPTIONS.indent_size,
      });

      if (prompts.isCancel(indentSize)) {
        prompts.cancel("Setup cancelled");
        throw new Error("Cancelled");
      }

      if (indentSize === "custom") {
        const customSize = await prompts.text({
          message: "Enter custom indent size (1-16)",
          validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 16) {
              return "Please enter a number between 1 and 16";
            }
            return undefined;
          },
        });

        if (prompts.isCancel(customSize)) {
          prompts.cancel("Setup cancelled");
          throw new Error("Cancelled");
        }

        this.globalRules.push({
          key: "indent_size",
          value: parseInt(customSize),
        });
      } else {
        this.globalRules.push({ key: "indent_size", value: indentSize });
      }
    }

    const additionalRules = await prompts.multiselect({
      message: "Additional global rules",
      options: [
        {
          value: "trim_trailing_whitespace",
          label: "Trim trailing whitespace",
          hint: "Remove spaces at line endings",
        },
        {
          value: "insert_final_newline",
          label: "Insert final newline",
          hint: "Ensure files end with newline",
        },
      ],
      initialValues: ["trim_trailing_whitespace", "insert_final_newline"],
      required: false,
    });

    if (!prompts.isCancel(additionalRules)) {
      for (const rule of additionalRules) {
        this.globalRules.push({ key: rule, value: true });
      }
    }

    prompts.log.success("Global rules configured\n");
  }

  private async setupFileTypeRules(context: ProjectContext): Promise<void> {
    prompts.log.step(chalk.cyan("File Type Specific Rules"));

    const detectedTypes = this.detectFileTypes(context);

    if (detectedTypes.length === 0) {
      prompts.log.warning("No specific file types detected");
      return;
    }

    prompts.log.message("Detected file types in your project:\n");

    const setupTypes = await prompts.multiselect({
      message: "Select file types to configure",
      options: detectedTypes.map((type) => ({
        value: type.key,
        label: type.label,
        hint: type.hint,
      })),
      initialValues: detectedTypes.map((t) => t.key),
      required: false,
    });

    if (prompts.isCancel(setupTypes) || setupTypes.length === 0) {
      return;
    }

    for (const typeKey of setupTypes) {
      const typeConfig =
        FILE_TYPE_RECOMMENDATIONS[
          typeKey as keyof typeof FILE_TYPE_RECOMMENDATIONS
        ];
      if (!typeConfig) continue;

      prompts.log.info(`\nConfiguring ${typeConfig.description}`);

      const approach = await prompts.select({
        message: `How would you like to configure ${typeConfig.description}?`,
        options: [
          {
            value: "recommended",
            label: "Use recommended settings",
            hint: "Quick setup",
          },
          {
            value: "customize",
            label: "Customize settings",
            hint: "Fine-tune rules",
          },
          { value: "skip", label: "Skip", hint: "Use global rules only" },
        ],
      });

      if (prompts.isCancel(approach) || approach === "skip") continue;

      if (approach === "recommended") {
        this.sections.push({
          pattern: typeConfig.pattern,
          rules: [...typeConfig.recommendedRules],
          description: typeConfig.description,
        });
      } else {
        await this.customizeFileType(typeConfig);
      }
    }

    if (this.sections.length > 0) {
      prompts.log.success(
        `\nFile type rules configured for ${this.sections.length} patterns`,
      );
    }
  }

  private async customizeFileType(typeConfig: any): Promise<void> {
    const rules: EditorConfigRule[] = [];

    const overrideIndent = await prompts.confirm({
      message: "Override global indentation settings?",
      initialValue: false,
    });

    if (!prompts.isCancel(overrideIndent) && overrideIndent) {
      const indentStyle = await prompts.select({
        message: `Indentation style for ${typeConfig.description}`,
        options: RULE_OPTIONS.indent_style,
      });

      if (!prompts.isCancel(indentStyle)) {
        rules.push({ key: "indent_style", value: indentStyle });

        if (indentStyle === "space") {
          const indentSize = await prompts.select({
            message: `Indentation size for ${typeConfig.description}`,
            options: RULE_OPTIONS.indent_size.filter(
              (opt) => opt.value !== "custom",
            ),
          });

          if (!prompts.isCancel(indentSize)) {
            rules.push({ key: "indent_size", value: indentSize });
          }
        }
      }
    }

    const setMaxLength = await prompts.confirm({
      message: "Set maximum line length?",
      initialValue: false,
    });

    if (!prompts.isCancel(setMaxLength) && setMaxLength) {
      const maxLength = await prompts.select({
        message: "Maximum line length",
        options: RULE_OPTIONS.max_line_length,
      });

      if (!prompts.isCancel(maxLength)) {
        if (maxLength === "custom") {
          const customLength = await prompts.text({
            message: "Enter custom max line length",
            validate: (value) => {
              const num = parseInt(value);
              if (isNaN(num) || num < 1) {
                return "Please enter a positive number";
              }
              return undefined;
            },
          });

          if (!prompts.isCancel(customLength)) {
            rules.push({
              key: "max_line_length",
              value: parseInt(customLength),
            });
          }
        } else if (maxLength !== "off") {
          rules.push({ key: "max_line_length", value: maxLength });
        }
      }
    }

    if (typeConfig.optionalRules && typeConfig.optionalRules.length > 0) {
      const specialRules = await prompts.multiselect({
        message: `Additional rules for ${typeConfig.description}`,
        options: typeConfig.optionalRules.map((rule: EditorConfigRule) => ({
          value: rule.key,
          label: `${rule.key} = ${rule.value}`,
          hint: rule.description,
        })),
        required: false,
      });

      if (!prompts.isCancel(specialRules)) {
        for (const ruleKey of specialRules) {
          const rule = typeConfig.optionalRules.find(
            (r: EditorConfigRule) => r.key === ruleKey,
          );
          if (rule) {
            rules.push(rule);
          }
        }
      }
    }

    this.sections.push({
      pattern: typeConfig.pattern,
      rules,
      description: typeConfig.description,
    });
  }

  private async setupCustomRules(): Promise<void> {
    const addCustom = await prompts.confirm({
      message: "\nAdd custom file patterns?",
      initialValue: false,
    });

    if (!addCustom || prompts.isCancel(addCustom)) return;

    prompts.log.step(chalk.cyan("Custom Pattern Configuration"));

    let addMore = true;
    while (addMore) {
      const pattern = await prompts.text({
        message: "File pattern (e.g., *.{css,scss} or src/**/*.js)",
        placeholder: "*.{css,scss}",
      });

      if (prompts.isCancel(pattern)) break;

      const rules: EditorConfigRule[] = [];

      const customizePattern = await prompts.confirm({
        message: `Add specific rules for ${pattern}?`,
        initialValue: true,
      });

      if (!prompts.isCancel(customizePattern) && customizePattern) {
        const setIndent = await prompts.confirm({
          message: "Set custom indentation?",
          initialValue: false,
        });

        if (!prompts.isCancel(setIndent) && setIndent) {
          const indentSize = await prompts.text({
            message: "Indent size",
            placeholder: "2",
            validate: (value) => {
              const num = parseInt(value);
              if (isNaN(num) || num < 1 || num > 16) {
                return "Please enter a number between 1 and 16";
              }
              return undefined;
            },
          });

          if (!prompts.isCancel(indentSize)) {
            rules.push({ key: "indent_size", value: parseInt(indentSize) });
          }
        }
      }

      this.sections.push({
        pattern,
        rules,
        description: `Custom pattern`,
      });

      const continueAdding = await prompts.confirm({
        message: "Add another custom pattern?",
        initialValue: false,
      });

      if (prompts.isCancel(continueAdding) || !continueAdding) {
        addMore = false;
      }
    }
  }

  private detectFileTypes(context: ProjectContext) {
    const types = [];
    const deps = {
      ...context.packageJson.dependencies,
      ...context.packageJson.devDependencies,
    };

    const baseTypes = ["json", "yaml", "markdown"];

    types.push({
      key: "javascript",
      label: "JavaScript (.js, .jsx)",
      hint: "Essential for Node.js projects",
    });

    if (context.hasTypeScript) {
      types.push({
        key: "typescript",
        label: "TypeScript (.ts, .tsx)",
        hint: "TypeScript configuration detected",
      });
    }

    if (
      deps["sass"] ||
      deps["less"] ||
      deps["styled-components"] ||
      deps["emotion"] ||
      context.projectType === "next" ||
      context.projectType === "vite"
    ) {
      types.push({
        key: "css",
        label: "Styles (.css, .scss, .sass, .less)",
        hint: "Style files detected",
      });
    }

    if (deps["python"] || deps["django"] || deps["flask"]) {
      types.push({
        key: "python",
        label: "Python (.py)",
        hint: "Python dependencies detected",
      });
    }

    if (deps["node-gyp"] || deps["cmake-js"]) {
      types.push({
        key: "makefile",
        label: "Makefile",
        hint: "Native build system detected",
      });
    }

    for (const baseType of baseTypes) {
      const config =
        FILE_TYPE_RECOMMENDATIONS[
          baseType as keyof typeof FILE_TYPE_RECOMMENDATIONS
        ];
      if (config) {
        types.push({
          key: baseType,
          label: config.description,
          hint: "Commonly used",
        });
      }
    }

    return types;
  }

  private generatePreview(): string {
    const lines = this.generate().split("\n");
    const maxLines = 20;

    if (lines.length <= maxLines) {
      return lines.join("\n");
    }

    return lines.slice(0, maxLines).join("\n") + "\n...";
  }

  private generate(): string {
    const lines: string[] = [
      "# EditorConfig is awesome: https://EditorConfig.org",
      "",
      "root = true",
      "",
    ];

    if (this.globalRules.length > 0) {
      lines.push("[*]");
      for (const rule of this.globalRules) {
        lines.push(`${rule.key} = ${rule.value}`);
      }
      lines.push("");
    }

    for (const section of this.sections) {
      if (section.description) {
        lines.push(`# ${section.description}`);
      }
      lines.push(`[${section.pattern}]`);

      if (section.rules.length > 0) {
        for (const rule of section.rules) {
          lines.push(`${rule.key} = ${rule.value}`);
        }
      }
      lines.push("");
    }

    while (lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.join("\n");
  }
}
