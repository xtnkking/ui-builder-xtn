#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { chromium, firefox, webkit } from "@playwright/test";

const require = createRequire(import.meta.url);
const playwrightVersion = require("@playwright/test/package.json").version;

function outputArgument(argv) {
  const index = argv.indexOf("--output");
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--output requires a file path");
  }
  return value;
}

async function inspectBrowser({ project, product, browserType }) {
  const browser = await browserType.launch({ headless: true });
  try {
    return {
      project,
      product,
      version: browser.version(),
      evidenceKind: "playwright-browser",
      realSafari: false,
      safariEvidence: false,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const browsers = [];
  for (const definition of [
    { project: "chromium", product: "Playwright Chromium", browserType: chromium },
    { project: "firefox", product: "Playwright Firefox", browserType: firefox },
    { project: "webkit", product: "Playwright WebKit", browserType: webkit },
  ]) {
    browsers.push(await inspectBrowser(definition));
  }

  const report = {
    schemaVersion: 1,
    evidenceKind: "playwright-browser-version-inventory",
    recordedAt: new Date().toISOString(),
    environment: {
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      playwright: playwrightVersion,
    },
    browsers,
    safari: {
      status: "pending-real-environment",
      minimumMajor: 18,
      acceptedFromThisReport: false,
      note: "Playwright WebKit is not real Safari evidence.",
    },
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const output = outputArgument(process.argv.slice(2));
  if (output) {
    const resolved = path.resolve(output);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, serialized, "utf8");
  } else {
    process.stdout.write(serialized);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
