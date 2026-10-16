import { defineConfig } from "@playwright/test";
import dimensions from "./playwright.dimensions.config";

export default defineConfig({
  ...dimensions,
  testMatch: ["modal-form-layout.spec.ts"],
  globalTimeout: 90_000,
  use: { ...dimensions.use, baseURL: "http://127.0.0.1:4220" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4220 --strictPort",
    url: "http://127.0.0.1:4220",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
