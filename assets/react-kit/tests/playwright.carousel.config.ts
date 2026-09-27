import { defineConfig } from "@playwright/test";
import baseConfig from "../playwright.config";

const baseURL = "http://127.0.0.1:4184";

export default defineConfig({
  ...baseConfig,
  testDir: ".",
  outputDir: "../test-results-carousel",
  use: { ...baseConfig.use, baseURL, trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4184 --strictPort",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
