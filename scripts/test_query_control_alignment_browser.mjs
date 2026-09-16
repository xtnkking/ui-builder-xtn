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
  const baseUrl = server.resolvedUrls?.local?.[0];
  assert.ok(baseUrl, "Vite did not expose a local URL");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE }
      : {}),
  });

  for (const width of [1440, 736, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 500 } });
    try {
      await page.goto(new URL("filter-bar-alignment-test.html", baseUrl).href);
      const filterBar = page.getByRole("form", { name: "权限筛选" });
      const search = filterBar.getByRole("searchbox", { name: "搜索权限键或说明" });
      const query = filterBar.getByRole("button", { name: "查询" });
      const ordinary = page.getByRole("button", { name: "普通操作" });
      await filterBar.waitFor();
      const geometry = await page.evaluate(() => {
        const bar = document.querySelector(".pui-filter-bar");
        const searchShell = document.querySelector(".pui-filter-bar .pui-input-shell");
        const queryButton = document.querySelector(".pui-filter-bar__actions .pui-button--medium");
        const barStyle = getComputedStyle(bar);
        const searchRect = searchShell.getBoundingClientRect();
        const queryRect = queryButton.getBoundingClientRect();
        return {
          bar: {
            backgroundColor: barStyle.backgroundColor,
            borders: [barStyle.borderTopWidth, barStyle.borderRightWidth, barStyle.borderBottomWidth, barStyle.borderLeftWidth],
            radii: [barStyle.borderTopLeftRadius, barStyle.borderTopRightRadius, barStyle.borderBottomRightRadius, barStyle.borderBottomLeftRadius],
            padding: [barStyle.paddingTop, barStyle.paddingRight, barStyle.paddingBottom, barStyle.paddingLeft],
          },
          search: { top: searchRect.top, bottom: searchRect.bottom, height: searchRect.height },
          query: { top: queryRect.top, bottom: queryRect.bottom, height: queryRect.height },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      assert.ok(await search.isVisible(), `search input is hidden at ${width}px`);
      assert.ok(await query.isVisible(), `query button is hidden at ${width}px`);
      assert.ok(Math.abs(geometry.search.height - 44) <= 0.5, `search input is not 44px at ${width}px`);
      assert.ok(Math.abs(geometry.query.height - 44) <= 0.5, `query button is not 44px at ${width}px`);
      assert.ok(Math.abs((await ordinary.boundingBox()).height - 38) <= 0.5, `ordinary button was globally enlarged at ${width}px`);
      assert.equal(geometry.bar.backgroundColor, "rgba(0, 0, 0, 0)", `filter bar has a background at ${width}px`);
      assert.deepEqual(geometry.bar.borders, ["0px", "0px", "0px", "0px"], `filter bar has a border at ${width}px`);
      assert.deepEqual(geometry.bar.radii, ["0px", "0px", "0px", "0px"], `filter bar retains container rounding at ${width}px`);
      assert.deepEqual(geometry.bar.padding, ["0px", "0px", "0px", "0px"], `filter bar retains container padding at ${width}px`);
      assert.ok(geometry.documentWidth <= geometry.viewportWidth, `filter bar overflows at ${width}px`);
      if (width > 640) {
        assert.ok(Math.abs(geometry.search.top - geometry.query.top) <= 0.5, "desktop query controls have different top edges");
        assert.ok(Math.abs(geometry.search.bottom - geometry.query.bottom) <= 0.5, "desktop query controls have different bottom edges");
      }
    } finally {
      await page.close();
    }
  }
  console.log("FilterBar query-control alignment regression passed at 1440px, 736px, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
