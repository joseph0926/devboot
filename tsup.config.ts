import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli/index.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  shims: true,
  minify: process.env.NODE_ENV === "production",
  target: "node22",
  sourcemap: true,
  splitting: false,
});
