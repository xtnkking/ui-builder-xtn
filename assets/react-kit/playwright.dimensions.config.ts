import { defineConfig } from "@playwright/test";

const evidenceRoot = process.env.UI_DIMENSIONS_EVIDENCE_DIR ?? "./test-results/dimensions";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["dimension-controls.spec.ts", "form-settings-sizing.spec.ts", "dimension-pagination.spec.ts", "table-dimensions.spec.ts", "dimension-overlays.spec.ts"],
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalTimeout: 180_000,
  expect: { timeout: 4_000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    baseURL: "http://127.0.0.1:4218",
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
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4218 --strictPort",
    url: "http://127.0.0.1:4218",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
