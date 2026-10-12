import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Bounded presentation inventory, not a behavior/accessibility acceptance matrix.
const kit = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const baseURL = option("--url", "http://127.0.0.1:4187/");
const output = path.resolve(option("--output", "explorer-visual-audit"));
const only = option("--only", "").split(",").filter(Boolean);
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
const source = { head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: kit, encoding: "utf8" }).trim(), workingSourceSha256: digest.digest("hex") };
const manifest = JSON.parse(await readFile(path.join(kit, "component-manifest.json"), "utf8"));
let server;
let browser;
const result = { kind: "presentation-inventory", source, baseURL, startedAt: new Date().toISOString(), families: [], errors: [] };
async function captureSurface(page, preview, id, state, basename) {
  if (!args.includes("--open-surfaces")) return undefined;
  const long = state.startsWith("长内容");
  const entries = {
    dialog: [long ? "长内容弹窗" : "编辑项目", ".pui-dialog:visible"],
    drawer: [long ? "打开长内容详情" : "打开成员详情", ".pui-drawer:visible"],
    popover: [long ? "详细筛选说明" : "筛选摘要", ".pui-popover__surface:visible"],
    menu: [long ? "长下拉菜单" : "下拉菜单", ".pui-dropdown__menu:visible"],
    toast: [long ? "长内容提示" : "右下错误胶囊", ".pui-toast:visible"],
    lightbox: [long ? "预览长说明图片" : "预览图片", '[data-pui-owner="Lightbox"]:visible'],
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
  if (id === "toast") await surface.locator(".pui-toast__close").click();
  else await page.keyboard.press("Escape");
  await surface.waitFor({ state: "hidden", timeout: 5000 });
  return { screenshot, bounds };
}
try {
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
  page.on("pageerror", error => result.errors.push(error.message));
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 20_000 });
  const links = await page.locator('[data-testid="explorer-directory"]').first().locator("a[href]").evaluateAll(nodes => nodes.map(node => ({ href: node.getAttribute("href"), label: node.textContent })));
  if (links.length !== manifest.entries.length) throw new Error(`Directory has ${links.length}/${manifest.entries.length} entries`);
  if (only.some(id => !links.some(link => link.href.split("/").at(-1) === id))) throw new Error("An explicitly requested family is missing from the directory");
  for (const link of links.filter(item => !only.length || only.includes(item.href.split("/").at(-1)))) {
    const id = link.href.split("/").at(-1);
    await page.evaluate(href => { window.location.hash = href; }, link.href);
    await page.locator(`[data-testid="explorer-directory"] a[aria-current="page"][href=${JSON.stringify(link.href)}]`).first().waitFor({ timeout: 8_000 });
    await page.locator('main [data-example-status="runnable"]').waitFor({ timeout: 8_000 });
    await page.locator("main .demo-explorer-preview").first().waitFor();
    const family = { id, route: link.href, label: link.label, views: [] };
    result.families.push(family);
    const stateTabs = page.locator(".demo-explorer-case").first().getByRole("tab");
    const states = await stateTabs.allTextContents();
    const selected = requestedStates.length ? states.filter(name => requestedStates.some(state => name === state || name.startsWith(`${state} ·`))) : ["总览", ...states.filter(name => /^(深色模式|长内容)(?: ·|$)/.test(name))];
    if (!selected.length) throw new Error(`No requested desktop states matched ${id}`);
    for (const [index, state] of selected.entries()) {
      await stateTabs.filter({ hasText: state }).first().click();
      await page.evaluate(() => document.fonts.ready);
      const preview = page.locator("main .demo-explorer-preview").first();
      await preview.scrollIntoViewIfNeeded();
      const metrics = await preview.evaluate(root => {
        const rect = root.getBoundingClientRect();
        const textClips = [];
        for (const node of root.querySelectorAll("*")) {
          if (node.children.length || !node.textContent.trim() || node.closest('.pui-sr-only,[class*="visually-hidden"]')) continue;
          const style = getComputedStyle(node);
          if (!/hidden|clip/.test(style.overflowY) || style.whiteSpace !== "nowrap") continue;
          const range = document.createRange(); range.selectNodeContents(node);
          const ink = range.getBoundingClientRect(); const box = node.getBoundingClientRect();
          if (box.width > 0 && box.height > 0 && (ink.top < box.top - 1 || ink.bottom > box.bottom + 1)) textClips.push({ text: node.textContent.slice(0, 80), className: node.className, lineHeight: style.lineHeight, fontSize: style.fontSize, boxHeight: box.height, textHeight: ink.height });
        }
        return { width: rect.width, height: rect.height, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, textClips, visibleControls: root.querySelectorAll('button,input,textarea,[role="combobox"],table').length, contentLength: root.textContent.trim().length };
      });
      const screenshot = `${id}-${index}.png`;
      await preview.screenshot({ path: path.join(output, screenshot), timeout: 10_000, animations: "disabled" });
      const surface = await captureSurface(page, preview, id, state, `${id}-${index}`);
      family.views.push({ state, screenshot, ...metrics, surface });
    }
    // A narrow container is not a mobile viewport; inspect actual responsive media queries too.
    const mobileSelected = states.find(state => state === mobileState || state.startsWith(`${mobileState} ·`)) ?? "总览";
    await stateTabs.filter({ hasText: mobileSelected }).first().click();
    await page.setViewportSize({ width: 320, height: 900 });
    const mobilePreview = page.locator("main .demo-explorer-preview").first();
    const mobileMetrics = await mobilePreview.evaluate(root => ({ width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await mobilePreview.screenshot({ path: path.join(output, `${id}-mobile.png`), animations: "disabled" });
    const mobileSurface = await captureSurface(page, mobilePreview, id, mobileSelected, `${id}-mobile`);
    family.mobile = { state: mobileSelected, screenshot: `${id}-mobile.png`, ...mobileMetrics, surface: mobileSurface };
    await page.setViewportSize({ width: 1440, height: 1100 });
    if (id === "button") {
      await stateTabs.filter({ hasText: "总览" }).first().click();
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".demo-explorer-preview .pui-button__label" });
      if (nodeId) result.fonts = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      await cdp.detach();
    }
    console.log(`${result.families.length}: ${id} (${family.views.length} views)`);
  }
  result.result = result.errors.length ? "failed" : "captured";
  if (result.errors.length) process.exitCode = 1;
} catch (error) {
  result.result = "failed";
  result.errors.push(error.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) server.kill();
  result.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, "inventory.json"), JSON.stringify(result, null, 2) + "\n");
}
