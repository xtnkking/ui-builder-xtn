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
    const selected = ["总览", ...states.filter(name => /^(深色模式|长内容)(?: ·|$)/.test(name))];
    for (const [index, state] of selected.entries()) {
      if (index) await stateTabs.filter({ hasText: state }).first().click();
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
      family.views.push({ state, screenshot, ...metrics });
    }
    // A narrow container is not a mobile viewport; inspect actual responsive media queries too.
    if (states.includes("总览")) await stateTabs.filter({ hasText: "总览" }).first().click();
    await page.setViewportSize({ width: 320, height: 900 });
    const mobilePreview = page.locator("main .demo-explorer-preview").first();
    const mobileMetrics = await mobilePreview.evaluate(root => ({ width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await mobilePreview.screenshot({ path: path.join(output, `${id}-mobile.png`), animations: "disabled" });
    family.mobile = { screenshot: `${id}-mobile.png`, ...mobileMetrics };
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
