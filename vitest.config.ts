import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["simulator/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
