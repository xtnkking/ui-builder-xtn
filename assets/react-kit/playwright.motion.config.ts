import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const evidenceRoot = process.env.UI_MOTION_EVIDENCE_DIR ?? "./test-results/motion";

// Eight Chromium-only groups plus two core groups on each existing engine:
// 14 executed cases; the 16 non-Chromium primary-group entries remain explicit skips.
export default defineConfig({
  ...base,
  testMatch: "**/browser/motion-enhancement.spec.ts",
  outputDir: `${evidenceRoot}/browser-artifacts`,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"], ["json", { outputFile: `${evidenceRoot}/browser-results.json` }]],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:4211",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on",
  },
  // The root agent starts the one guarded development preview separately.
  webServer: undefined,
});
