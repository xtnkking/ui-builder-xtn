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
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(new URL("filter-bar-alignment-test.html", baseUrl).href);
      const filterBar = page.getByRole("form", { name: "权限筛选", exact: true });
      const search = filterBar.getByRole("searchbox", { name: "搜索权限键或说明" });
      const query = filterBar.getByRole("button", { name: "查询" });
      const reset = filterBar.getByRole("button", { name: "重置" });
      const inlineFilterBar = page.getByRole("form", { name: "内联权限筛选", exact: true });
      const inlineSearch = inlineFilterBar.getByRole("searchbox", { name: "内联搜索" });
      const inlineQuery = inlineFilterBar.getByRole("button", { name: "内联查询" });
      const standaloneSearch = page.getByRole("searchbox", { name: "独立搜索" });
      const standaloneQuery = page.getByRole("button", { name: "独立查询" });
      const ordinary = page.getByRole("button", { name: "普通操作" });
      const compact = page.getByRole("button", { name: "紧凑操作" });
      await filterBar.waitFor();
      const geometry = await page.evaluate(() => {
        const bar = document.querySelector(".pui-filter-bar");
        const barStyle = getComputedStyle(bar);
        return {
          bar: {
            backgroundColor: barStyle.backgroundColor,
            borders: [barStyle.borderTopWidth, barStyle.borderRightWidth, barStyle.borderBottomWidth, barStyle.borderLeftWidth],
            radii: [barStyle.borderTopLeftRadius, barStyle.borderTopRightRadius, barStyle.borderBottomRightRadius, barStyle.borderBottomLeftRadius],
            padding: [barStyle.paddingTop, barStyle.paddingRight, barStyle.paddingBottom, barStyle.paddingLeft],
          },
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      const shellRect = async (locator) => locator.evaluate((element) => {
        const shell = element.closest(".pui-input-shell");
        if (!(shell instanceof HTMLElement)) throw new Error("search input has no Personal UI shell");
        const rect = shell.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      const rect = async (locator, label) => {
        const box = await locator.boundingBox();
        assert.ok(box, `${label} is hidden at ${width}px`);
        return { top: box.y, bottom: box.y + box.height, width: box.width, height: box.height };
      };
      const searchRect = await shellRect(search);
      const queryRect = await rect(query, "query button");
      const resetRect = await rect(reset, "reset button");
      const inlineSearchRect = await shellRect(inlineSearch);
      const inlineQueryRect = await rect(inlineQuery, "inline query button");
      const standaloneSearchRect = await shellRect(standaloneSearch);
      const standaloneQueryRect = await rect(standaloneQuery, "standalone query button");
      const ordinaryRect = await rect(ordinary, "ordinary button");
      const compactRect = await rect(compact, "compact button");
      assert.ok(Math.abs(searchRect.height - 44) <= 0.5, `search input is not 44px at ${width}px`);
      assert.ok(Math.abs(queryRect.height - 44) <= 0.5, `field-sized action query is not 44px at ${width}px`);
      assert.ok(Math.abs(resetRect.height - 44) <= 0.5, `field-sized reset is not 44px at ${width}px`);
      assert.ok(Math.abs(inlineSearchRect.height - 44) <= 0.5, `inline search input is not 44px at ${width}px`);
      assert.ok(Math.abs(inlineQueryRect.height - 44) <= 0.5, `legacy medium button inside FilterBar Inline is not 44px at ${width}px`);
      assert.ok(Math.abs(standaloneSearchRect.height - 44) <= 0.5, `standalone search input is not 44px at ${width}px`);
      assert.ok(Math.abs(standaloneQueryRect.height - 44) <= 0.5, `explicit field-sized button outside FilterBar is not 44px at ${width}px`);
      assert.ok(Math.abs(ordinaryRect.height - 38) <= 0.5, `ordinary button was globally enlarged at ${width}px`);
      assert.ok(Math.abs(compactRect.height - 32) <= 0.5, `small button height changed at ${width}px`);
      assert.equal(await inlineQuery.evaluate((element) => element.classList.contains("pui-button--medium")), true, "FilterBar compatibility case is no longer medium");
      assert.equal(await standaloneQuery.evaluate((element) => element.classList.contains("pui-button--field")), true, "explicit field size class is missing");
      assert.equal(geometry.bar.backgroundColor, "rgba(0, 0, 0, 0)", `filter bar has a background at ${width}px`);
      assert.deepEqual(geometry.bar.borders, ["0px", "0px", "0px", "0px"], `filter bar has a border at ${width}px`);
      assert.deepEqual(geometry.bar.radii, ["0px", "0px", "0px", "0px"], `filter bar retains container rounding at ${width}px`);
      assert.deepEqual(geometry.bar.padding, ["0px", "0px", "0px", "0px"], `filter bar retains container padding at ${width}px`);
      assert.ok(geometry.documentWidth <= geometry.viewportWidth, `filter bar overflows at ${width}px`);
      if (width > 640) {
        assert.ok(Math.abs(searchRect.top - queryRect.top) <= 0.5, "desktop action query controls have different top edges");
        assert.ok(Math.abs(searchRect.bottom - queryRect.bottom) <= 0.5, "desktop action query controls have different bottom edges");
        assert.ok(Math.abs(inlineSearchRect.top - inlineQueryRect.top) <= 0.5, "desktop inline query controls have different top edges");
        assert.ok(Math.abs(inlineSearchRect.bottom - inlineQueryRect.bottom) <= 0.5, "desktop inline query controls have different bottom edges");
        assert.ok(Math.abs(standaloneSearchRect.top - standaloneQueryRect.top) <= 0.5, "desktop standalone query controls have different top edges");
        assert.ok(Math.abs(standaloneSearchRect.bottom - standaloneQueryRect.bottom) <= 0.5, "desktop standalone query controls have different bottom edges");
      }
      const idleQueryRect = await rect(query, "idle query button");
      await query.click();
      await page.waitForFunction(() => document.querySelector('form[aria-label="权限筛选"] button[aria-busy="true"]'));
      const loadingQueryRect = await rect(query, "loading query button");
      assert.ok(Math.abs(idleQueryRect.width - loadingQueryRect.width) <= 0.5, `query button width changed while loading at ${width}px`);
      assert.ok(Math.abs(idleQueryRect.height - loadingQueryRect.height) <= 0.5, `query button height changed while loading at ${width}px`);
    } finally {
      await page.close();
    }
  }
  console.log("Field-sized, FilterBar Inline, loading, and ordinary button geometry passed at 1440px, 736px, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
