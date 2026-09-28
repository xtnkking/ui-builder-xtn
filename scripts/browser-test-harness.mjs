import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const supportedBrowserNames = new Set(["chromium", "firefox", "webkit"]);

export function getPersonalUiBrowserName(environment = process.env) {
  const browserName = (environment.PERSONAL_UI_BROWSER || "chromium").trim().toLowerCase();
  assert.ok(
    supportedBrowserNames.has(browserName),
    `PERSONAL_UI_BROWSER must be chromium, firefox, or webkit; received ${JSON.stringify(browserName)}`,
  );
  return browserName;
}

export async function launchPersonalUiBrowser(options = {}) {
  const browserName = getPersonalUiBrowserName();
  const playwright = kitRequire("@playwright/test");
  const browserType = playwright[browserName];
  assert.equal(typeof browserType?.launch, "function", `Playwright does not expose the ${browserName} browser type`);

  const browserSpecificExecutable = process.env[`PERSONAL_UI_${browserName.toUpperCase()}_EXECUTABLE`];
  const executablePath = process.env.PERSONAL_UI_BROWSER_EXECUTABLE || browserSpecificExecutable;
  return browserType.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    ...options,
  });
}

export function isPersonalUiRegressionMain(metaUrl, argv = process.argv) {
  const entryPath = argv[1];
  return Boolean(entryPath) && pathToFileURL(resolve(entryPath)).href === metaUrl;
}

export async function runPersonalUiRegression(regression, options = {}) {
  const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
  const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
  let browser;
  let context;
  try {
    await server.listen();
    const baseURL = server.resolvedUrls?.local?.[0];
    assert.ok(baseURL, "Vite did not expose a local URL");
    browser = await launchPersonalUiBrowser();
    context = await browser.newContext({
      baseURL,
      locale: "zh-CN",
      timezoneId: "Asia/Shanghai",
      viewport: options.viewport ?? { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await regression({ page, baseURL });
  } finally {
    await context?.close();
    await browser?.close();
    await server.close();
  }
}
