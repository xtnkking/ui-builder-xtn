import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = "http://127.0.0.1:4192";

export default defineConfig(base, {
  outputDir: "./test-results-m5-adjacent",
  workers: 1,
  timeout: 30_000,
  use: { baseURL },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4192",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
