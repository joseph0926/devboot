import { BaseModule } from "./base.module.js";
import { EditorConfigModule } from "./editorconfig/index.js";
import { TypeScriptModule } from "./typescript/index.js";
import { PrettierModule } from "./prettier/index.js";

export class ModuleRegistry {
  private static modules = new Map<string, BaseModule>();

  static {
    this.register(new EditorConfigModule());
    this.register(new PrettierModule());
    this.register(new TypeScriptModule());
    // this.register(new GitHooksModule());
  }

  static register(module: BaseModule): void {
    this.modules.set(module.name, module);
  }

  static get(name: string): BaseModule | undefined {
    return this.modules.get(name);
  }

  static getAll(): BaseModule[] {
    return Array.from(this.modules.values());
  }

  static has(name: string): boolean {
    return this.modules.has(name);
  }

  static list(): string[] {
    return Array.from(this.modules.keys());
  }
}
