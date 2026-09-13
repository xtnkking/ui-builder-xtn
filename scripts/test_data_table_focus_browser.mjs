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

  for (const width of [2560, 1440, 1024, 736]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url);
      const action = page.locator(".pui-data-table tbody tr .pui-data-table__cell--pin-end .pui-icon-button").first();
      await action.waitFor();
      for (let index = 0; index < 80 && !await action.evaluate((button) => document.activeElement === button); index += 1) {
        await page.keyboard.press("Tab");
      }
      assert.equal(await action.evaluate((button) => document.activeElement === button), true, `button not reachable by Tab at ${width}px`);
      const geometry = await action.evaluate((button) => {
        const content = button.closest(".pui-data-table__cell-content");
        const cell = button.closest("td");
        const buttonBox = button.getBoundingClientRect();
        const cellBox = cell.getBoundingClientRect();
        const buttonStyle = getComputedStyle(button);
        return {
          focusVisible: button.matches(":focus-visible"),
          contentOverflow: getComputedStyle(content).overflowX,
          outlineWidth: parseFloat(buttonStyle.outlineWidth),
          outlineOffset: parseFloat(buttonStyle.outlineOffset),
          buttonLeft: buttonBox.left,
          buttonRight: buttonBox.right,
          cellLeft: cellBox.left,
          cellRight: cellBox.right,
          viewportWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      const focusGutter = geometry.outlineWidth + geometry.outlineOffset;
      assert.ok(geometry.focusVisible, `keyboard focus not visible at ${width}px`);
      assert.equal(geometry.contentOverflow, "visible", `table content clipped the focus ring at ${width}px`);
      assert.ok(geometry.outlineWidth >= 2, `focus indicator missing at ${width}px`);
      assert.ok(geometry.buttonLeft - focusGutter >= geometry.cellLeft, `focus ring clipped on the left at ${width}px`);
      assert.ok(geometry.buttonRight + focusGutter <= geometry.cellRight, `focus ring clipped on the right at ${width}px`);
      assert.ok(geometry.documentWidth <= geometry.viewportWidth, `horizontal overflow at ${width}px`);
      if (process.env.PERSONAL_UI_TABLE_FOCUS_SCREENSHOT_PREFIX) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_FOCUS_SCREENSHOT_PREFIX}-${width}.png` });
      }
    } finally {
      await page.close();
    }
  }
  console.log("DataTable action focus regression passed at 2560, 1440, 1024, and 736px.");
} finally {
  await browser?.close();
  await server.close();
}
