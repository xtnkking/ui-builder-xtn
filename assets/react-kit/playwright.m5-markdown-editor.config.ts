import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const baseURL = "http://127.0.0.1:4189";

export default defineConfig({
  ...baseConfig,
  outputDir: "./test-results-m5-markdown-editor",
  use: { ...baseConfig.use, baseURL },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4189",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
