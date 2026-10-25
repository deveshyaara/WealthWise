import { defineConfig } from "vitest/config";
import path from "path";

const rootDir = import.meta.dirname || path.resolve(".");

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./"),
    },
  },
});
