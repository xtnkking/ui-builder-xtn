import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = "http://127.0.0.1:4198";

export default defineConfig({
  ...base,
  outputDir: "./test-results-d2-drag-upload",
  retries: 0,
  workers: 1,
  // These focused contracts preserve assertion logs; do not create temporary
  // trace/video directories that Windows blocks during worker cleanup.
  use: { ...base.use, baseURL, trace: "off", video: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4198 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
