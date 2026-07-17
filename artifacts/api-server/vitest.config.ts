import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    // Honour the "workspace" condition used by monorepo lib packages so that
    // their TypeScript source is resolved directly (the same way esbuild does
    // it at build time).
    conditions: ["workspace"],
  },
});
