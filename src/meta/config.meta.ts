export interface ConfigMetadata {
  name: string;
  displayName: string;
  description: string;
  category: "linting" | "testing" | "building" | "git" | "editor" | "other";
  conflictsWith?: string[];
  requiredWith?: string[];
}

export class ConfigMetadataRegistry {
  private static readonly metadata: Map<string, ConfigMetadata> = new Map([
    [
      "eslint",
      {
        name: "eslint",
        displayName: "ESLint",
        description: "JavaScript/TypeScript linting",
        category: "linting",
        conflictsWith: ["biome"],
      },
    ],
    [
      "prettier",
      {
        name: "prettier",
        displayName: "Prettier",
        description: "Code formatting",
        category: "linting",
        requiredWith: ["eslint"],
      },
    ],
    [
      "typescript",
      {
        name: "typescript",
        displayName: "TypeScript",
        description: "Type-safe JavaScript",
        category: "building",
      },
    ],
    [
      "husky",
      {
        name: "husky",
        displayName: "Husky",
        description: "Git hooks",
        category: "git",
        requiredWith: ["lint-staged"],
      },
    ],
    [
      "editorconfig",
      {
        name: "editorconfig",
        displayName: "EditorConfig",
        description: "Consistent coding styles across editors",
        category: "editor",
      },
    ],
  ]);

  static get(name: string): ConfigMetadata | undefined {
    return this.metadata.get(name);
  }

  static getAll(): ConfigMetadata[] {
    return Array.from(this.metadata.values());
  }

  static getByCategory(category: string): ConfigMetadata[] {
    return this.getAll().filter((m) => m.category === category);
  }
}
