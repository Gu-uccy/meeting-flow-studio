import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/__tests__/setupEmbeddingsMock.ts"],
    testTimeout: 30000,
    hookTimeout: 15000,
    // Run test files sequentially to avoid SQLite contention
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
