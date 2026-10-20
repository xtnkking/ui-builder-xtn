import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_DROPDOWN_ICON_EVIDENCE_DIR ?? "./test-results/dropdown-icon";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "dropdown-icon-trigger.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  globalTimeout: 150_000,
  expect: { timeout: 5000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4213",
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 5000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
