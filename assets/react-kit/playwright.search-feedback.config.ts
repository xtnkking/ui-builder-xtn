import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_SEARCH_FEEDBACK_EVIDENCE_DIR ?? "./test-results/search-feedback";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "search-feedback.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 110_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4216",
    viewport: { width: 1440, height: 1100 },
    actionTimeout: 5_000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4216 --strictPort",
    url: "http://127.0.0.1:4216",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
