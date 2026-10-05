#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CONFIG_KIND = "personal-ui-m8-browser-quality-worker-config";
const BEHAVIOR_KIND = "personal-ui-m8-browser-behavior";
const RESPONSIVE_KIND = "personal-ui-m8-responsive-measurement";
const PRODUCTS = {
  chromium: "Playwright Chromium",
  firefox: "Playwright Firefox",
  webkit: "Playwright WebKit",
};

function configArgument(argv) {
  const index = argv.indexOf("--config");
  if (index === -1 || !argv[index + 1] || argv[index + 1].startsWith("--")) {
    throw new Error("--config requires a JSON file path");
  }
  if (argv.length !== 2 || index !== 0) {
    throw new Error("the browser worker accepts only --config <path>");
  }
  return path.resolve(argv[index + 1]);
}

function stringArray(value, label) {
  assert.ok(
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim()),
    `${label} must be a non-empty string array`,
  );
  return value;
}

function positiveInteger(value, label) {
  assert.ok(Number.isSafeInteger(value) && value > 0, `${label} must be a positive integer`);
  return value;
}

async function loadConfig(configPath) {
  const value = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(value.schemaVersion, 1, "worker config schemaVersion must be 1");
  assert.equal(value.kind, CONFIG_KIND, `worker config kind must be ${CONFIG_KIND}`);
  assert.equal(typeof value.scenarioId, "string", "worker config scenarioId must be a string");
  const projectRoot = await realpath(value.projectRoot);
  const outputRoot = await realpath(value.outputRoot);
  const behaviorModule = await realpath(value.behaviorModule);
  const relativeBehavior = path.relative(projectRoot, behaviorModule);
  assert.ok(
    relativeBehavior && !relativeBehavior.startsWith("..") && !path.isAbsolute(relativeBehavior),
    "behaviorModule must resolve inside projectRoot",
  );
  const readyUrl = new URL(value.readyUrl);
  const targetUrl = new URL(value.url);
  assert.equal(readyUrl.protocol, "http:", "readyUrl must use HTTP");
  assert.equal(targetUrl.protocol, "http:", "url must use HTTP");
  assert.equal(readyUrl.origin, targetUrl.origin, "readyUrl and url must use one server");
  return {
    ...value,
    projectRoot,
    outputRoot,
    behaviorModule,
    serverArgv: stringArray(value.serverArgv, "serverArgv"),
    engines: stringArray(value.engines, "engines"),
    widths: value.widths.map((width) => positiveInteger(width, "width")),
    viewportHeight: positiveInteger(value.viewportHeight, "viewportHeight"),
    actionTimeoutMs: positiveInteger(value.actionTimeoutMs, "actionTimeoutMs"),
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(child, config, spawnFailure) {
  const deadline = Date.now() + Number(config.serverTimeoutSeconds) * 1000;
  let lastError = "server did not answer";
  while (Date.now() < deadline) {
    if (spawnFailure.value) throw spawnFailure.value;
    if (child.exitCode !== null) {
      throw new Error(`server exited before readiness with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(config.readyUrl, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
      lastError = `server returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`server readiness timed out: ${lastError}`);
}

async function waitForExit(child, milliseconds) {
  if (child.exitCode !== null) return true;
  return Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(milliseconds).then(() => false),
  ]);
}

async function waitForServerStopped(url, milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) });
    } catch {
      return;
    }
    await delay(100);
  }
  throw new Error(`server remained reachable after process-tree termination: ${url}`);
}

async function stopServer(child, readyUrl = null) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await waitForExit(child, 5000);
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
    if (!(await waitForExit(child, 5000))) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
      await waitForExit(child, 5000);
    }
  }
  if (readyUrl) await waitForServerStopped(readyUrl, 5000);
}

function startServer(config) {
  const [executable, ...args] = config.serverArgv;
  process.stdout.write(`[m8-quality] server argv: ${JSON.stringify(config.serverArgv)}\n`);
  const child = spawn(executable, args, {
    cwd: config.projectRoot,
    env: process.env,
    shell: false,
    windowsHide: true,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const spawnFailure = { value: null };
  child.once("error", (error) => {
    spawnFailure.value = error;
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return { child, spawnFailure };
}

async function writeJsonExclusive(target, value) {
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function severeRules(items) {
  return items.filter((item) => item?.impact === "critical" || item?.impact === "serious");
}

export async function executeScenario({ runScenario, page, expect, engine, width, url }) {
  const assertions = [];
  const names = new Set();
  const pending = [];
  const check = (name, assertion) => {
    assert.equal(typeof name, "string", "check name must be a string");
    assert.ok(name.trim(), "check name must not be empty");
    assert.equal(typeof assertion, "function", `check ${JSON.stringify(name)} must receive a function`);
    assert.ok(!names.has(name), `check name must be unique: ${name}`);
    names.add(name);
    const promise = Promise.resolve()
      .then(assertion)
      .then(() => assertions.push({ name, result: "passed" }));
    promise.catch(() => {});
    pending.push(promise);
    return promise;
  };

  let scenarioError;
  try {
    // The return value is deliberately ignored. Only executed check callbacks can pass behavior.
    await runScenario({ page, expect, check, engine, width, url });
  } catch (error) {
    scenarioError = error;
  }
  const settled = await Promise.allSettled(pending);
  if (scenarioError) throw scenarioError;
  const rejected = settled.find((item) => item.status === "rejected");
  if (rejected) throw rejected.reason;
  assert.ok(assertions.length > 0, "runScenario must execute at least one check(name, assertion)");
  return assertions;
}

async function measurePage(page) {
  return page.evaluate(() => {
    if (!document.body) throw new Error("scenario page has no document.body");
    return {
      documentElementClientWidth: document.documentElement.clientWidth,
      documentElementScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
}

async function runMatrix(config) {
  const consumerRequire = createRequire(path.join(config.projectRoot, "package.json"));
  const playwright = consumerRequire("@playwright/test");
  const axeModule = consumerRequire("@axe-core/playwright");
  const AxeBuilder = axeModule.default ?? axeModule;
  const playwrightVersion = consumerRequire("@playwright/test/package.json").version;
  const scenarioModule = await import(pathToFileURL(config.behaviorModule).href);
  assert.equal(
    typeof scenarioModule.runScenario,
    "function",
    "behaviorModule must export async function runScenario(context)",
  );
  const rawRoot = path.join(config.outputRoot, "raw");
  await mkdir(rawRoot, { recursive: false });
  const browsers = [];

  for (const engine of config.engines) {
    assert.ok(Object.hasOwn(PRODUCTS, engine), `unsupported browser engine: ${engine}`);
    const browserType = playwright[engine];
    assert.equal(typeof browserType?.launch, "function", `Playwright does not expose ${engine}`);
    const browser = await browserType.launch({ headless: true });
    try {
      const browserVersion = browser.version();
      browsers.push({
        project: engine,
        product: PRODUCTS[engine],
        version: browserVersion,
        evidenceKind: "playwright-browser",
        realSafari: false,
        safariEvidence: false,
      });
      for (const width of config.widths) {
        process.stdout.write(`[m8-quality] ${engine}/${width}\n`);
        const context = await browser.newContext({
          viewport: { width, height: config.viewportHeight },
          deviceScaleFactor: 1,
        });
        try {
          const page = await context.newPage();
          page.setDefaultTimeout(config.actionTimeoutMs);
          page.setDefaultNavigationTimeout(config.actionTimeoutMs);
          await page.goto(config.url, { waitUntil: "networkidle", timeout: config.actionTimeoutMs });
          const scenarioUrl = page.url();
          const assertions = await executeScenario({
            runScenario: scenarioModule.runScenario,
            page,
            expect: playwright.expect,
            engine,
            width,
            url: scenarioUrl,
          });
          const actualUrl = page.url();
          const axeResults = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          const stem = path.join(rawRoot, `${engine}-${width}`);
          await writeJsonExclusive(`${stem}-axe.json`, axeResults);
          assert.ok(Array.isArray(axeResults.passes) && axeResults.passes.length > 0, "axe scan has no passes");
          const blocking = [...severeRules(axeResults.violations), ...severeRules(axeResults.incomplete)];
          assert.equal(
            blocking.length,
            0,
            `axe found blocking rules: ${blocking.map((item) => item.id).join(", ")}`,
          );
          const documentFacts = await measurePage(page);
          const overflow =
            documentFacts.documentElementClientWidth !== width ||
            documentFacts.documentElementScrollWidth > documentFacts.documentElementClientWidth ||
            documentFacts.bodyClientWidth > width ||
            documentFacts.bodyScrollWidth > width;
          assert.equal(overflow, false, `page has horizontal overflow at ${engine}/${width}`);
          await page.screenshot({
            path: `${stem}.png`,
            animations: "disabled",
            fullPage: false,
          });
          const userAgent = await page.evaluate(() => navigator.userAgent);
          const recordedAt = new Date().toISOString();
          await writeJsonExclusive(`${stem}-behavior.json`, {
            schemaVersion: 1,
            kind: BEHAVIOR_KIND,
            scenarioId: config.scenarioId,
            engine,
            width,
            result: "passed",
            recordedAt,
            browserVersion,
            userAgent,
            url: actualUrl,
            deviceScaleFactor: 1,
            assertions,
          });
          await writeJsonExclusive(`${stem}-responsive.json`, {
            schemaVersion: 1,
            kind: RESPONSIVE_KIND,
            scenarioId: config.scenarioId,
            engine,
            width,
            result: "passed",
            viewport: { width, height: config.viewportHeight },
            document: documentFacts,
            pageHorizontalOverflow: false,
            assertions: [
              { name: "document viewport matches requested width", result: "passed" },
              { name: "document has no horizontal overflow", result: "passed" },
              { name: "body has no horizontal overflow", result: "passed" },
            ],
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }

  await writeJsonExclusive(path.join(config.outputRoot, "browser-versions.raw.json"), {
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
      acceptedFromThisReport: false,
      note: "Playwright WebKit is not real Safari evidence.",
    },
  });
}

async function main() {
  const configPath = configArgument(process.argv.slice(2));
  const config = await loadConfig(configPath);
  const { child, spawnFailure } = startServer(config);
  let serverWasReady = false;
  try {
    await waitForServer(child, config, spawnFailure);
    serverWasReady = true;
    await runMatrix(config);
  } finally {
    await stopServer(child, serverWasReady ? config.readyUrl : null);
  }
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
