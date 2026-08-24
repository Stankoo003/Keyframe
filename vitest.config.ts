import { defineConfig } from "vitest/config";

/**
 * Samo za ciste module (`tests/unit`). E2E ostaje Playwright — razloge protiv
 * jsdom-a za ponasanje plejera vidi u `playwright.config.ts`.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": new URL("./src/", import.meta.url).pathname },
  },
});
