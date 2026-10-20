import { defineConfig } from "@playwright/test";
const evidenceRoot = process.env.UI_COMPONENT_DETAIL_EVIDENCE_DIR ?? "./test-results/component-detail";
export default defineConfig({
  testDir: "./tests/browser", testMatch: "component-detail.spec.ts", outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1, retries: 0, timeout: 35_000, globalTimeout: 160_000, expect: { timeout: 5000 },
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: { baseURL: "http://127.0.0.1:4213", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "zh-CN", actionTimeout: 5000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
