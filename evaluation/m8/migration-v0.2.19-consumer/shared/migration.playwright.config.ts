import { defineConfig } from "@playwright/test";

const port = Number(process.env.M8_MIGRATION_PORT ?? "4178");

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  reporter: "line",
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
