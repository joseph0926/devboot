import { readFile } from "../../utils/file.js";
import path from "path";

export interface TSConfigAnalysis {
  isValid: boolean;
  config: any;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export class TSConfigAnalyzer {
  async analyze(projectPath: string): Promise<TSConfigAnalysis> {
    const result: TSConfigAnalysis = {
      isValid: false,
      config: null,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      const content = await readFile(path.join(projectPath, "tsconfig.json"));

      try {
        result.config = JSON.parse(content);
        result.isValid = true;
      } catch (error) {
        result.errors.push("Invalid JSON format");
        return result;
      }

      this.analyzeCompilerOptions(result);
      this.analyzeIncludes(result);
      this.checkCommonIssues(result);

      return result;
    } catch (error) {
      result.errors.push(`Failed to read tsconfig.json: ${error}`);
      return result;
    }
  }

  private analyzeCompilerOptions(analysis: TSConfigAnalysis): void {
    const { compilerOptions } = analysis.config;

    if (!compilerOptions) {
      analysis.warnings.push("No compilerOptions found");
      return;
    }

    if (!compilerOptions.target) {
      analysis.warnings.push("No target specified, defaulting to ES3");
    }

    if (!compilerOptions.module) {
      analysis.warnings.push("No module system specified");
    }

    if (!compilerOptions.strict && !compilerOptions.strictNullChecks) {
      analysis.suggestions.push(
        "Consider enabling strict mode for better type safety",
      );
    }

    if (compilerOptions.target === "ES5" || compilerOptions.target === "ES6") {
      analysis.suggestions.push(
        "Consider upgrading target to ES2022 for modern JavaScript features",
      );
    }
  }

  private analyzeIncludes(analysis: TSConfigAnalysis): void {
    if (!analysis.config.include && !analysis.config.files) {
      analysis.warnings.push(
        "No 'include' or 'files' specified. All TypeScript files will be included.",
      );
    }
  }

  private checkCommonIssues(analysis: TSConfigAnalysis): void {
    const { compilerOptions } = analysis.config;

    if (compilerOptions?.jsx && !compilerOptions.target?.includes("ES")) {
      analysis.warnings.push("JSX requires ES target for proper support");
    }

    if (compilerOptions?.paths && !compilerOptions.baseUrl) {
      analysis.errors.push("'paths' requires 'baseUrl' to be specified");
    }
  }
}
