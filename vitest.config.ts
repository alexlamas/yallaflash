import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    css: true,
    // Playwright specs live in e2e/ and run via `npm run test:e2e`;
    // vitest's default include (**/*.spec.ts) must not pick them up.
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "app/test-utils/",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/__tests__/**",
        "*.config.*",
        ".next/",
        "components/ui/", // shadcn components
      ],
      thresholds: {
        // Start with low thresholds, increase as coverage improves
        lines: 20,
        functions: 20,
        branches: 15,
        statements: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
