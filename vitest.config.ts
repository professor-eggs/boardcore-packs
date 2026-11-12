import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["packs/*/test/**/*.test.ts"], testTimeout: 60_000 },
});
