import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fixture = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "astro:content": fixture("./tests/stubs/astro-content.ts"),
      "astro/loaders": fixture("./tests/stubs/astro-loaders.ts"),
      "astro/zod": "zod",
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
