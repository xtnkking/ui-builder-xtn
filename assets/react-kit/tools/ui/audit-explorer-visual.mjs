import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectExplorerDirectory, selectAuditCases, summarizeCapturedMetrics } from "./explorer-visual-audit-core.mjs";

// Bounded presentation inventory, not a behavior/accessibility acceptance matrix.
const kit = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
// --case family/case-id selects a later case; omission remains first-case-only.
const option = (name, fallback) => {
  const inline = args.find(arg => arg.startsWith(`${name}=`));
  return inline !== undefined ? inline.slice(name.length + 1) : args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
};
const baseURL = option("--url", "http://127.0.0.1:4187/");
const output = path.resolve(option("--output", "explorer-visual-audit"));
const only = option("--only", "").split(",").filter(Boolean);
const requestedCases = option("--case", "").split(",").filter(Boolean);
const stateNames = { overview: "总览", longContent: "长内容", dark: "深色模式" };
const requestedStates = option("--states", "").split(",").filter(Boolean).map(state => stateNames[state] ?? state);
const mobileState = stateNames[option("--mobile-state", "overview")] ?? option("--mobile-state", "总览");
await mkdir(output, { recursive: true });
const digest = createHash("sha256");
async function hashTree(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await hashTree(target);
    else digest.update(path.relative(kit, target)).update(await readFile(target));
  }
}
await hashTree(path.join(kit, "src"));
digest.update(await readFile(path.join(kit, "component-manifest.json")));
digest.update(await readFile(path.join(kit, "component-docs.json")));
const source = { head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: kit, encoding: "utf8" }).trim(), workingSourceSha256: digest.digest("hex") };
const manifest = JSON.parse(await readFile(path.join(kit, "component-manifest.json"), "utf8"));
const docs = JSON.parse(await readFile(path.join(kit, "component-docs.json"), "utf8"));
const toolDigest = createHash("sha256");
for (const filename of ["audit-explorer-visual.mjs", "explorer-visual-audit-core.mjs"]) toolDigest.update(filename).update(await readFile(new URL(filename, import.meta.url)));
let server;
let browser;
const result = {
  kind: "presentation-inventory", source, toolSha256: toolDigest.digest("hex"), baseURL, startedAt: new Date().toISOString(),
  scope: { families: only.length ? only : "all-directory-families", caseSelection: requestedCases.length ? "explicit-case-ids" : "first-case-only", requestedCases, desktopStates: requestedStates.length ? requestedStates : ["总览", "长内容", "深色模式"], mobileState, surfaceCapture: args.includes("--open-surfaces") },
  acceptance: "not-evaluated", interpretation: "Captured screenshots and heuristic observations require visual review; captured is not a visual, behavior or accessibility pass.",
  families: [], errors: [],
};
async function captureSurface(page, preview, id, state, basename) {
  if (!args.includes("--open-surfaces")) return undefined;
  const long = state.startsWith("长内容");
  const entries = {
    dialog: [long ? "长内容弹窗" : "编辑项目", ".ui-dialog:visible"],
    drawer: [long ? "打开长内容详情" : "打开成员详情", ".ui-drawer:visible"],
    popover: [long ? "详细筛选说明" : "筛选摘要", ".ui-popover__surface:visible"],
    menu: [long ? "长下拉菜单" : "下拉菜单", ".ui-dropdown__menu:visible"],
    toast: [long ? "长内容提示" : "右下错误胶囊", ".ui-toast:visible"],
    lightbox: [long ? "预览长说明图片" : "预览图片", '[data-ui-owner="Lightbox"]:visible'],
  };
  let surface;
  if (id === "select") {
    await preview.getByRole("combobox", { name: long ? /^长选项/ : /^角色/ }).first().click();
    surface = page.getByRole("listbox").last();
  } else if (entries[id]) {
    const [name, selector] = entries[id];
    await preview.getByRole("button", { name, exact: true }).click();
    surface = page.locator(selector).last();
  } else return undefined;
  await surface.waitFor({ state: "visible", timeout: 5000 });
  const bounds = await surface.boundingBox();
  const screenshot = `${basename}-surface.png`;
  await surface.screenshot({ path: path.join(output, screenshot), animations: "disabled" });
  if (id === "toast") await surface.locator(".ui-toast__close").click();
  else await page.keyboard.press("Escape");
  await surface.waitFor({ state: "hidden", timeout: 5000 });
  return { screenshot, bounds, outcome: "captured-not-accepted" };
}
async function captureMetrics(preview) {
  return preview.evaluate(root => {
    const rect = root.getBoundingClientRect();
    const textClips = [];
    for (const node of root.querySelectorAll("*")) {
      if (node.children.length || !node.textContent.trim() || node.closest('.ui-sr-only,[class*="visually-hidden"]')) continue;
      const style = getComputedStyle(node);
      if (!/hidden|clip/.test(style.overflowY) || style.whiteSpace !== "nowrap") continue;
      const range = document.createRange(); range.selectNodeContents(node);
      const ink = range.getBoundingClientRect(); const box = node.getBoundingClientRect();
      if (box.width > 0 && box.height > 0 && (ink.top < box.top - 1 || ink.bottom > box.bottom + 1)) textClips.push({ text: node.textContent.slice(0, 80), className: node.className, lineHeight: style.lineHeight, fontSize: style.fontSize, boxHeight: box.height, textHeight: ink.height });
    }
    return { width: rect.width, height: rect.height, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, textClips, visibleControls: root.querySelectorAll('button,input,textarea,[role="combobox"],table').length, contentLength: root.textContent.trim().length };
  });
}
try {
  if (requestedCases.length && (!only.length || requestedCases.some(id => !id.includes("/") || !only.includes(id.split("/")[0])) || only.some(id => !requestedCases.some(caseId => caseId.startsWith(`${id}/`))))) {
    throw new Error("--case requires exact family/case ids and --only listing those same families; no implicit family or case fallback is allowed");
  }
  if (args.includes("--serve")) {
    const address = new URL(baseURL);
    server = spawn(process.execPath, [path.join(kit, "node_modules/vite/bin/vite.js"), "--host", address.hostname, "--port", address.port, "--strictPort"], { cwd: kit, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let logs = "";
    server.stdout.on("data", chunk => { logs += chunk; });
    server.stderr.on("data", chunk => { logs += chunk; });
    const deadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      if (server.exitCode !== null) throw new Error(`Preview server exited: ${logs}`);
      try { ready = (await fetch(baseURL)).ok; } catch { /* bounded readiness */ }
      if (!ready) await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!ready) throw new Error(`Preview server did not start: ${logs}`);
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, locale: "zh-CN", reducedMotion: "reduce" });
  page.setDefaultTimeout(8_000);
  page.on("pageerror", error => result.errors.push(error.message));
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 20_000 });
  const links = await page.locator('[data-testid="explorer-directory"]').first().locator("a[href]").evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute("href"), label: node.textContent })));
  const directory = inspectExplorerDirectory(links, manifest, docs);
  result.directory = { expectedRoutes: directory.expectedRoutes, excluded: directory.excluded, errors: directory.errors };
  if (directory.errors.length) throw new Error(directory.errors.join("\n"));
  if (only.some(id => !directory.families.some(link => link.id === id))) throw new Error("An explicitly requested family is missing from the directory");
  for (const link of directory.families.filter(item => !only.length || only.includes(item.id))) {
    const { id } = link;
    await page.evaluate(href => { window.location.hash = href; }, link.href);
    await page.locator(`[data-testid="explorer-directory"] a[aria-current="page"][href=${JSON.stringify(link.href)}]`).first().waitFor({ timeout: 8_000 });
    await page.locator('main [data-example-status="runnable"]').waitFor({ timeout: 8_000 });
    const caseTabs = page.locator('main .demo-explorer-cases > [data-ui-owner="Tabs"] > [role="tablist"] > [role="tab"]');
    // Explorer declares one preview followed by one source tab for each case.
    const availableCaseTabs = (await caseTabs.allTextContents()).map((label, tabIndex) => ({ label, tabIndex })).filter(item => item.tabIndex % 2 === 0);
    const discovered = [];
    for (const entry of requestedCases.length ? availableCaseTabs : availableCaseTabs.slice(0, 1)) {
      await caseTabs.nth(entry.tabIndex).click();
      const caseRoot = page.locator("main .demo-explorer-case");
      await caseRoot.waitFor();
      const caseId = await caseRoot.getAttribute("data-explorer-case");
      if (!caseId) throw new Error(`Case ${entry.label} is missing its stable Explorer id`);
      discovered.push({ ...entry, id: caseId });
    }
    const selectedCases = selectAuditCases(discovered, requestedCases.filter(caseId => caseId.startsWith(`${id}/`)));
    const family = { id, route: link.href, label: link.label, availableCaseTabs, discoveredCases: discovered, cases: [] };
    result.families.push(family);
    for (const selectedCase of selectedCases) {
      await caseTabs.nth(selectedCase.tabIndex).click();
      const caseRoot = page.locator(`main [data-explorer-case=${JSON.stringify(selectedCase.id)}]`);
      await caseRoot.waitFor();
      const stateTabs = caseRoot.locator(':scope > [data-ui-owner="Tabs"] > [role="tablist"] > [role="tab"]');
      const hasStateTabs = (await stateTabs.count()) > 0;
      const states = hasStateTabs ? await stateTabs.allTextContents() : ["总览"];
      const matchesState = (name, state) => name === state || name.startsWith(`${state} ·`);
      if (requestedStates.some(state => !states.some(name => matchesState(name, state)))) throw new Error(`A requested desktop state is missing from ${selectedCase.id}`);
      const selected = requestedStates.length ? states.filter(name => requestedStates.some(state => matchesState(name, state))) : states.filter(name => /^(总览|深色模式|长内容)(?: ·|$)/.test(name));
      const caseRecord = { id: selectedCase.id, label: selectedCase.label, availableStates: states, views: [] };
      family.cases.push(caseRecord);
      const basename = selectedCase.id.replaceAll(/[^\w-]/g, "-");
      for (const [index, state] of selected.entries()) {
        if (hasStateTabs) await stateTabs.getByText(state, { exact: true }).click();
        await page.evaluate(() => document.fonts.ready);
        const preview = caseRoot.locator(".demo-explorer-preview");
        await preview.scrollIntoViewIfNeeded();
        const metrics = await captureMetrics(preview);
        const screenshot = `${basename}-${index}.png`;
        await preview.screenshot({ path: path.join(output, screenshot), timeout: 10_000, animations: "disabled" });
        const surface = await captureSurface(page, preview, id, state, `${basename}-${index}`);
        caseRecord.views.push({ state, screenshot, ...metrics, ...summarizeCapturedMetrics(metrics), surface });
      }
      // A narrow container is not a mobile viewport: inspect actual media queries.
      const mobileSelected = states.find(state => matchesState(state, mobileState)) ?? "总览";
      if (hasStateTabs) await stateTabs.getByText(mobileSelected, { exact: true }).click();
      await page.setViewportSize({ width: 320, height: 900 });
      const mobilePreview = caseRoot.locator(".demo-explorer-preview");
      await mobilePreview.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const mobileMetrics = await captureMetrics(mobilePreview);
      await mobilePreview.screenshot({ path: path.join(output, `${basename}-mobile.png`), animations: "disabled" });
      const mobileSurface = await captureSurface(page, mobilePreview, id, mobileSelected, `${basename}-mobile`);
      caseRecord.mobile = { requestedState: mobileState, state: mobileSelected, screenshot: `${basename}-mobile.png`, ...mobileMetrics, ...summarizeCapturedMetrics(mobileMetrics), surface: mobileSurface };
      await page.setViewportSize({ width: 1440, height: 1100 });
      if (id === "button") {
        if (hasStateTabs) await stateTabs.getByText("总览", { exact: true }).click();
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".demo-explorer-preview .ui-button__label" });
        if (nodeId) caseRecord.fonts = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        await cdp.detach();
      }
      console.log(`${id}: ${selectedCase.id} (${caseRecord.views.length} desktop views, 1 mobile view)`);
    }
  }
  result.result = result.errors.length ? "capture-failed" : "captured-not-accepted";
  if (result.errors.length) process.exitCode = 1;
} catch (error) {
  result.result = "capture-failed";
  result.errors.push(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill();
  result.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, "inventory.json"), JSON.stringify(result, null, 2) + "\n");
}
