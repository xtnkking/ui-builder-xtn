import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const evidenceRoot = process.env.UI_TOAST_EVIDENCE_DIR ?? "./test-results/toast-scrollbar";

export default defineConfig({
  ...base,
  testMatch: "**/browser/toast-scrollbar.spec.ts",
  projects: base.projects?.filter((project) => project.name === "chromium"),
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 20_000,
  globalTimeout: 120_000,
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:4211",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: undefined,
});
