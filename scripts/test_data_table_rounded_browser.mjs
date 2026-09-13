import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const { chromium } = createRequire(import.meta.url)(process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

async function assertRounded(table, label, { paginated, empty = false }) {
  const geometry = await table.evaluate((element) => {
    const frame = element.querySelector(".pui-data-table__frame");
    const frameStyle = getComputedStyle(frame);
    const frameRect = frame.getBoundingClientRect();
    const scroller = frame.querySelector(".pui-data-table__scroller");
    const mobile = frame.querySelector(".pui-data-table__mobile");
    const surface = frame.querySelector(".pui-empty")
      ?? (getComputedStyle(scroller).display === "none" ? mobile : scroller);
    const surfaceStyle = getComputedStyle(surface);
    const pager = frame.querySelector(".pui-data-table__pagination");
    const pagination = pager?.querySelector(".pui-pagination");
    return {
      width: frameRect.width,
      frameRadii: [frameStyle.borderTopLeftRadius, frameStyle.borderTopRightRadius, frameStyle.borderBottomRightRadius, frameStyle.borderBottomLeftRadius],
      frameBorders: [frameStyle.borderTopWidth, frameStyle.borderRightWidth, frameStyle.borderBottomWidth, frameStyle.borderLeftWidth],
      surfaceRadii: [surfaceStyle.borderTopLeftRadius, surfaceStyle.borderTopRightRadius, surfaceStyle.borderBottomRightRadius, surfaceStyle.borderBottomLeftRadius],
      marker: frame.classList.contains("pui-data-table__frame--paginated"),
      pager: pager ? {
        left: pager.getBoundingClientRect().left,
        right: pager.getBoundingClientRect().right,
        top: pager.getBoundingClientRect().top,
        bottom: pager.getBoundingClientRect().bottom,
        topBorder: getComputedStyle(pager).borderTopWidth,
        bottomRadii: [getComputedStyle(pager).borderBottomRightRadius, getComputedStyle(pager).borderBottomLeftRadius],
        paginationTopBorder: getComputedStyle(pagination).borderTopWidth,
      } : null,
      frame: { left: frameRect.left, right: frameRect.right, bottom: frameRect.bottom },
      surface: { left: surface.getBoundingClientRect().left, right: surface.getBoundingClientRect().right, bottom: surface.getBoundingClientRect().bottom },
    };
  });
  assert.ok(geometry.width > 0, `${label}: surface collapsed`);
  assert.deepEqual(geometry.frameRadii, ["12px", "12px", "12px", "12px"], `${label}: four frame corners differ`);
  assert.deepEqual(geometry.frameBorders, ["1px", "1px", "1px", "1px"], `${label}: frame outline incomplete`);
  assert.equal(geometry.marker, paginated, `${label}: pagination mode marker differs`);
  assert.deepEqual(geometry.surfaceRadii, paginated ? ["11px", "11px", "0px", "0px"] : ["11px", "11px", "11px", "11px"], `${label}: inner corners differ`);
  assert.ok(Math.abs(geometry.surface.left - (geometry.frame.left + 1)) <= 1, `${label}: surface left edge detached`);
  assert.ok(Math.abs(geometry.surface.right - (geometry.frame.right - 1)) <= 1, `${label}: surface right edge detached`);
  if (paginated) {
    assert.ok(geometry.pager, `${label}: pagination not attached to table`);
    assert.equal(geometry.pager.topBorder, "1px", `${label}: divider missing`);
    assert.equal(geometry.pager.paginationTopBorder, "0px", `${label}: divider duplicated`);
    assert.deepEqual(geometry.pager.bottomRadii, ["11px", "11px"], `${label}: pagination bottom corners differ`);
    assert.ok(Math.abs(geometry.surface.bottom - geometry.pager.top) <= 1, `${label}: pagination has a gap below rows`);
    assert.ok(Math.abs(geometry.pager.bottom - (geometry.frame.bottom - 1)) <= 1, `${label}: pagination escaped frame`);
    assert.ok(Math.abs(geometry.pager.left - geometry.surface.left) <= 1 && Math.abs(geometry.pager.right - geometry.surface.right) <= 1, `${label}: pagination width differs from table`);
  } else {
    assert.equal(geometry.pager, null, `${label}: unpaginated table has pagination`);
    assert.ok(Math.abs(geometry.surface.bottom - (geometry.frame.bottom - 1)) <= 1, `${label}: surface bottom edge detached`);
  }
  if (empty) assert.equal(await table.locator(".pui-empty").count(), 1, `${label}: empty state missing`);
}

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

  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url);
      const table = page.locator(".pui-data-page .pui-data-table");
      const surface = table.locator(width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller");
      const scenario = page.getByRole("group", { name: "选择下一次查询响应" });
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      await assertRounded(table, `ready ${width}px`, { paginated: true });
      const lastRow = surface.locator(width <= 640 ? ".pui-mobile-data-row:last-child" : "tbody tr:last-child td:last-child");
      assert.equal(await lastRow.evaluate((element) => getComputedStyle(element).borderBottomWidth), "0px", `double bottom line at ${width}px`);
      const readyHeight = await surface.evaluate((element) => element.getBoundingClientRect().height);

      await scenario.getByRole("button", { name: "空结果" }).click();
      await page.getByRole("button", { name: "查询", exact: true }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      await assertRounded(table, `loading ${width}px`, { paginated: true });
      const loadingHeight = await surface.evaluate((element) => element.getBoundingClientRect().height);
      assert.ok(Math.abs(readyHeight - loadingHeight) <= 1, `table resized while loading at ${width}px`);
      await page.locator('.pui-data-page .pui-data-table[data-state="empty"]').waitFor();
      await assertRounded(table, `empty ${width}px`, { paginated: false, empty: true });

      await scenario.getByRole("button", { name: "正常返回" }).click();
      await table.getByRole("button", { name: "查看全部成员" }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      await assertRounded(table, `recovered ${width}px`, { paginated: true });
      await scenario.getByRole("button", { name: "请求失败" }).click();
      await page.getByRole("button", { name: "查询", exact: true }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="error"]').waitFor();
      await assertRounded(table, `error ${width}px`, { paginated: true });
      assert.equal(await table.locator(":scope > .pui-alert").count(), 1, `error alert moved inside table at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}px`);
    } finally {
      await page.close();
    }
  }
  console.log("DataTable rounded ready/loading/empty/error browser regression passed at 2560, 1440, 1024, 736, 360, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
