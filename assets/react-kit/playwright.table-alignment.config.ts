import { defineConfig } from "@playwright/test";
import dimensions from "./playwright.dimensions.config";

export default defineConfig({
  ...dimensions,
  testMatch: ["table-height-policy.spec.ts"],
  grep: /@project-height|@table-alignment/,
  globalTimeout: 90_000,
  use: { ...dimensions.use, baseURL: "http://127.0.0.1:4221", deviceScaleFactor: 1.25 },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4221 --strictPort",
    url: "http://127.0.0.1:4221",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
