import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/directives/index.ts", "src/estimators/index.ts"],
  splitting: false,
  sourcemap: false,
  clean: true,
  format: ["cjs", "esm"],
});
