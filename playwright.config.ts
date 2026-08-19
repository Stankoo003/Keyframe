import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright — provera pristupacnosti plejera.
 *
 * Zasto browser, a ne jsdom: tri od pet kriterijuma zadatka ("dostupno samo
 * tastaturom", "fokus je vidljiv", "fokus se ne zakljucava") su o stvarnom
 * ponasanju fokusa, koje jsdom ne modeluje. Isto vazi za renderovanje cue-ova.
 *
 * PREDUSLOVI: Postgres dignut, migriran i seed-ovan, i mreza — media i .vtt se
 * povlace sa R2. Vidi "Testovi" u README-u.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "line" : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],

  webServer: {
    // `next dev`, a ne `build && start`: obe strane su force-dynamic pa build
    // izlaz nije drugaciji ni u cemu sto se ovde testira, a petlja je brza.
    // Na CI-ju bi islo `npm run build && npm start`.
    command: "npm run dev",
    // Health endpoint, ne "/": vraca 503 kad Postgres padne, pa Playwright
    // pukne sa jasnom greskom umesto da istekne na renderovanoj error strani.
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },

  globalSetup: "./tests/e2e/global-setup.ts",
});
