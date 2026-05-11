import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "lucide-react"],
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/__tests__/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "simulator/**/*.test.ts",
      "policy/**/*.test.ts",
      "visualization/**/*.test.ts",
    ],
    exclude: ["src/agents/agent6-quantum-readiness/tests/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**", "src/integrations/**"],
      exclude: ["src/lib/supabase.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
});
