import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next.js uses React's automatic JSX runtime. Vitest must compile JSX the same way.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/test/**", "src/__tests__/**"],
    },
  },
});
