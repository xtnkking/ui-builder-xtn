import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_FILTER_HINT_EVIDENCE_DIR ?? "./test-results/filter-hint-sizing";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "filter-hint-sizing.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 28_000,
  globalTimeout: 100_000,
  expect: { timeout: 4_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4217",
    viewport: { width: 2048, height: 1100 },
    actionTimeout: 4_000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "light",
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4217 --strictPort",
    url: "http://127.0.0.1:4217",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
