import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_CONTENT_EVIDENCE_DIR ?? "./test-results/motion-content";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/browser/motion-content.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 18_000,
  globalTimeout: 120_000,
  expect: { timeout: 3_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4211",
    viewport: { width: 1440, height: 1100 },
    actionTimeout: 3_000,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  // The guarded preview already owns4211; this check never starts/replaces it.
  webServer: undefined,
});
