import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_TABLE_ACTIONS_EVIDENCE_DIR ?? "./test-results/table-actions";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "table-actions.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 25_000,
  globalTimeout: 100_000,
  expect: { timeout: 4_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4214",
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 4_000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4214 --strictPort",
    url: "http://127.0.0.1:4214",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
