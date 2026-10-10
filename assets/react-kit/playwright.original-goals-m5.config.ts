import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = "http://127.0.0.1:4192";
export default defineConfig({
  ...base,
  outputDir: "./test-results-original-goals-m5",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  // Focused keyboard/axe contracts do not assert recording artifacts. Avoid the
  // diagnosed Windows tracing/video teardown failure while retaining assertions.
  use: { ...base.use, baseURL, trace: "off", video: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4192",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
