import { defineConfig } from "@playwright/test";
import baseConfig from "../playwright.config";

const baseURL = "http://127.0.0.1:4185";

export default defineConfig({
  ...baseConfig,
  testDir: ".",
  outputDir: "../test-results-m5-tree-isolated",
  use: { ...baseConfig.use, baseURL, trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4185 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
