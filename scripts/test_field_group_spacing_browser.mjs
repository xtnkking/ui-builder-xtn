import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const { chromium } = createRequire(import.meta.url)(process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

try {
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite did not expose a local URL");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage({ viewport: { width: 736, height: 700 } });
  await page.goto(url);

  const geometry = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.style.cssText = "position:fixed;inset:20px auto auto 20px;width:570px;padding:20px;background:white;z-index:99999";
    fixture.innerHTML = `
      <div class="pui-field" data-test="regular-field">
        <label class="pui-label"><span>Host or IP</span><span class="pui-label__required">Required</span></label>
        <input class="pui-input" value="92.113.135.107">
      </div>
      <div style="height:24px"></div>
      <fieldset class="pui-field pui-field--group" data-test="group-field">
        <legend class="pui-label"><span>Authentication method</span></legend>
        <div class="pui-segmented" role="group" aria-label="Authentication method">
          <button type="button" aria-pressed="true">Keep</button>
          <button type="button" aria-pressed="false">Replace</button>
          <button type="button" aria-pressed="false">None</button>
        </div>
        <div class="pui-field__hint">Choose how credentials are handled.</div>
      </fieldset>`;
    document.body.append(fixture);

    const regular = fixture.querySelector('[data-test="regular-field"]');
    const group = fixture.querySelector('[data-test="group-field"]');
    const regularLabel = regular.querySelector(".pui-label").getBoundingClientRect();
    const regularControl = regular.querySelector(".pui-input").getBoundingClientRect();
    const groupLabel = group.querySelector(".pui-label").getBoundingClientRect();
    const groupControl = group.querySelector(".pui-segmented").getBoundingClientRect();
    const groupHint = group.querySelector(".pui-field__hint").getBoundingClientRect();

    return {
      regularGap: regularControl.top - regularLabel.bottom,
      groupGap: groupControl.top - groupLabel.bottom,
      groupHintGap: groupHint.top - groupControl.bottom,
    };
  });

  assert.ok(Math.abs(geometry.regularGap - 7) <= 0.1, `regular Field gap drifted: ${geometry.regularGap}px`);
  assert.ok(Math.abs(geometry.groupGap - geometry.regularGap) <= 0.1, `group Field gap differs: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.groupHintGap - 7) <= 0.1, `group Field hint gap drifted: ${geometry.groupHintGap}px`);
  console.log(`Field and Field group spacing match at ${geometry.groupGap}px.`);
} finally {
  await browser?.close();
  await server.close();
}
