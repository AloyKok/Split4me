import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/__tests__/**/*.test.ts"],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
