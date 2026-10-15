import { defineConfig } from "@playwright/test";

const evidence = process.env.UI_TABLE_TOAST_EVIDENCE_DIR ?? "./test-results/table-toast";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "data-table-toast.spec.ts",
  outputDir: `${evidence}/browser-artifacts`,
  workers: 1, retries: 0, timeout: 30_000, globalTimeout: 90_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["json", { outputFile: `${evidence}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4211", viewport: { width: 1440, height: 1000 },
    actionTimeout: 5_000, locale: "zh-CN", timezoneId: "Asia/Shanghai",
    reducedMotion: "no-preference", trace: "retain-on-failure", screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4211 --strictPort",
    url: "http://127.0.0.1:4211", reuseExistingServer: true, timeout: 20_000,
  },
});
