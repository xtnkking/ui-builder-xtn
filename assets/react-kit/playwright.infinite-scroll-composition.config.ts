import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = "http://127.0.0.1:4199";

export default defineConfig({
  ...base,
  outputDir: "./test-results-infinite-scroll-composition",
  retries: 0,
  workers: 1,
  timeout: 45_000,
  // Keep focused assertion evidence without temporary trace/video cleanup.
  use: { ...base.use, baseURL, trace: "off", video: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4199 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
