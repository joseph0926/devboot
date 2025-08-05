import { fileExists } from "../../utils/file.js";
import path from "path";
import { readFile } from "fs/promises";

export interface ConfigFormatOptions {
  // ESLint formats
  eslintFormats: {
    legacy: string[];
    flat: string[];
  };
  // Prettier formats
  prettierFormats: string[];
}

export interface ProjectEnvironment {
  isESModule: boolean;
  hasTypeScript: boolean;
  nodeVersion?: string;
  packageManager: string;
}

export class ConfigFormatDetector {

  static async detectProjectEnvironment(projectPath: string): Promise<ProjectEnvironment> {
    const packageJsonPath = path.join(projectPath, "package.json");
    const tsconfigPath = path.join(projectPath, "tsconfig.json");

    let isESModule = false;
    let packageManager = "npm";

    // Check package.json for module type
    if (await fileExists(packageJsonPath)) {
      try {
        const packageContent = await readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageContent);
        
        isESModule = packageJson.type === "module";
        
        // Detect package manager
        if (await fileExists(path.join(projectPath, "pnpm-lock.yaml"))) {
          packageManager = "pnpm";
        } else if (await fileExists(path.join(projectPath, "yarn.lock"))) {
          packageManager = "yarn";
        }
      } catch (error) {
        // If package.json is malformed, assume defaults
      }
    }

    const hasTypeScript = await fileExists(tsconfigPath);

    return {
      isESModule,
      hasTypeScript,
      nodeVersion: process.version,
      packageManager
    };
  }

  static recommendESLintConfigFormat(
    environment: ProjectEnvironment,
    eslintVersion: "v8" | "v9"
  ): { filename: string; extension: string; reason: string } {
    if (eslintVersion === "v8") {
      // Legacy ESLint
      if (environment.hasTypeScript) {
        return {
          filename: ".eslintrc.js",
          extension: "js",
          reason: "JavaScript format provides better flexibility for TypeScript projects"
        };
      }
      return {
        filename: ".eslintrc.json", 
        extension: "json",
        reason: "JSON format is simple and widely supported"
      };
    } else {
      // Flat config ESLint (v9)
      if (environment.hasTypeScript) {
        return {
          filename: "eslint.config.ts",
          extension: "ts",
          reason: "TypeScript format provides type safety and better IDE support"
        };
      } else if (environment.isESModule) {
        return {
          filename: "eslint.config.mjs",
          extension: "mjs",
          reason: "ES module format matches your project's module system"
        };
      } else {
        return {
          filename: "eslint.config.js",
          extension: "js",
          reason: "JavaScript format with CommonJS compatibility"
        };
      }
    }
  }

  static recommendPrettierConfigFormat(
    environment: ProjectEnvironment
  ): { filename: string; extension: string; reason: string } {
    if (environment.hasTypeScript) {
      return {
        filename: "prettier.config.js",
        extension: "js", 
        reason: "JavaScript format allows for dynamic configuration and comments"
      };
    } else if (environment.isESModule) {
      return {
        filename: ".prettierrc.mjs",
        extension: "mjs",
        reason: "ES module format matches your project's module system"
      };
    } else {
      return {
        filename: ".prettierrc.json",
        extension: "json",
        reason: "JSON format is simple and widely supported"
      };
    }
  }

  static getAvailableESLintFormats(eslintVersion: "v8" | "v9"): Array<{
    filename: string;
    extension: string;
    description: string;
    pros: string[];
    cons: string[];
  }> {
    if (eslintVersion === "v8") {
      return [
        {
          filename: ".eslintrc.json",
          extension: "json",
          description: "JSON configuration file",
          pros: ["Simple and clean", "Widely supported", "Easy to read"],
          cons: ["No comments allowed", "No dynamic configuration"]
        },
        {
          filename: ".eslintrc.js",
          extension: "js",
          description: "JavaScript configuration file",
          pros: ["Supports comments", "Dynamic configuration", "Conditional logic"],
          cons: ["More complex", "Requires JavaScript knowledge"]
        },
        {
          filename: ".eslintrc.cjs",
          extension: "cjs",
          description: "CommonJS configuration file",
          pros: ["Explicit CommonJS format", "Works in ES module projects"],
          cons: ["Requires Node.js 12+", "Less common"]
        },
        {
          filename: ".eslintrc.yml",
          extension: "yml",
          description: "YAML configuration file",
          pros: ["Human readable", "Supports comments", "Concise syntax"],
          cons: ["YAML syntax learning curve", "Indentation sensitive"]
        }
      ];
    } else {
      return [
        {
          filename: "eslint.config.js",
          extension: "js",
          description: "JavaScript flat configuration",
          pros: ["Full JavaScript flexibility", "CommonJS compatible"],
          cons: ["More verbose than JSON"]
        },
        {
          filename: "eslint.config.mjs",
          extension: "mjs",
          description: "ES Module flat configuration", 
          pros: ["Native ES modules", "Modern syntax", "Tree shaking"],
          cons: ["Requires Node.js 14+", "ES module syntax"]
        },
        {
          filename: "eslint.config.cjs",
          extension: "cjs",
          description: "CommonJS flat configuration",
          pros: ["Explicit CommonJS", "Backward compatible"],
          cons: ["Verbose CommonJS syntax"]
        },
        {
          filename: "eslint.config.ts",
          extension: "ts",
          description: "TypeScript flat configuration",
          pros: ["Type safety", "IDE support", "IntelliSense"],
          cons: ["Requires TypeScript", "Additional compilation step"]
        }
      ];
    }
  }

  static getAvailablePrettierFormats(): Array<{
    filename: string;
    extension: string;
    description: string;
    pros: string[];
    cons: string[];
  }> {
    return [
      {
        filename: ".prettierrc.json",
        extension: "json",
        description: "JSON configuration file",
        pros: ["Simple and clean", "Widely supported", "Easy to read"],
        cons: ["No comments allowed", "No dynamic configuration"]
      },
      {
        filename: ".prettierrc.js",
        extension: "js", 
        description: "JavaScript configuration file",
        pros: ["Supports comments", "Dynamic configuration", "Conditional logic"],
        cons: ["More complex", "Requires JavaScript knowledge"]
      },
      {
        filename: "prettier.config.js",
        extension: "js",
        description: "JavaScript configuration file (alternative)",
        pros: ["Same as .prettierrc.js", "More explicit naming"],
        cons: ["Same as .prettierrc.js"]
      },
      {
        filename: ".prettierrc.cjs",
        extension: "cjs",
        description: "CommonJS configuration file",
        pros: ["Explicit CommonJS format", "Works in ES module projects"],
        cons: ["Requires Node.js 12+", "Less common"]
      },
      {
        filename: ".prettierrc.mjs",
        extension: "mjs",
        description: "ES Module configuration file",
        pros: ["Native ES modules", "Modern syntax"],
        cons: ["Requires Node.js 14+", "ES module syntax"]
      }
    ];
  }
}