import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = fileURLToPath(new URL("../assets/react-kit/", import.meta.url));
const kitRequire = createRequire(new URL("../assets/react-kit/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(kitRequire.resolve("vite")).href);
const { chromium } = createRequire(import.meta.url)(process.env.PERSONAL_UI_PLAYWRIGHT_MODULE || "playwright");
const server = await createServer({ root: kitRoot, server: { host: "127.0.0.1", port: 0 } });
let browser;

async function settledScrollTop(locator, baseline) {
  return locator.evaluate((element, initial) => new Promise((resolve) => {
    let previous = element.scrollTop;
    let stableFrames = 0;
    let frames = 0;
    let moved = Math.abs(previous - initial) > 0.5;
    const sample = () => {
      const current = element.scrollTop;
      moved ||= Math.abs(current - initial) > 0.5;
      stableFrames = Math.abs(current - previous) <= 0.25 ? stableFrames + 1 : 0;
      previous = current;
      frames += 1;
      if ((moved && stableFrames >= 3) || frames >= 120) {
        resolve(current);
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), baseline);
}

async function settledWindowScroll(page) {
  return page.evaluate(() => new Promise((resolve) => {
    let previous = window.scrollY;
    let stableFrames = 0;
    let frames = 0;
    const sample = () => {
      const current = window.scrollY;
      stableFrames = Math.abs(current - previous) <= 0.25 ? stableFrames + 1 : 0;
      previous = current;
      frames += 1;
      if (stableFrames >= 4 || frames >= 120) {
        resolve(current);
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}

async function pixelAt(page, point) {
  return page.screenshot({
    clip: {
      x: Math.floor(point.x),
      y: Math.floor(point.y),
      width: 1,
      height: 1,
    },
  });
}

async function assertDesktopGutterPaint(page, table, label) {
  const points = await table.evaluate((element) => {
    const surface = element.querySelector(".pui-data-table__scroller");
    const header = surface.querySelector("thead th:last-child");
    const bodyCell = surface.querySelector("tbody tr:first-child td:last-child");
    const surfaceRect = surface.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const bodyRect = bodyCell.getBoundingClientRect();
    const gutterWidth = surface.offsetWidth - surface.clientWidth;
    return {
      gutterWidth,
      headerReference: { x: headerRect.right - 4, y: (headerRect.top + headerRect.bottom) / 2 },
      headerGutter: { x: surfaceRect.right - (gutterWidth / 2), y: (headerRect.top + headerRect.bottom) / 2 },
      bodyReference: { x: bodyRect.right - 4, y: (bodyRect.top + bodyRect.bottom) / 2 },
      bodyGutter: { x: surfaceRect.right - (gutterWidth / 2), y: (bodyRect.top + bodyRect.bottom) / 2 },
    };
  });
  assert.ok(points.gutterWidth >= 2, `${label}: stable scrollbar gutter is missing`);
  const [headerReference, headerGutter, bodyReference, bodyGutter] = await Promise.all([
    pixelAt(page, points.headerReference),
    pixelAt(page, points.headerGutter),
    pixelAt(page, points.bodyReference),
    pixelAt(page, points.bodyGutter),
  ]);
  assert.ok(headerReference.equals(headerGutter), `${label}: scrollbar gutter does not continue the table header background`);
  assert.ok(bodyReference.equals(bodyGutter), `${label}: scrollbar gutter does not continue the table body background`);
}

async function assertRounded(table, label, { paginated, empty = false }) {
  const geometry = await table.evaluate((element) => {
    const frame = element.querySelector(".pui-data-table__frame");
    const frameStyle = getComputedStyle(frame);
    const frameRect = frame.getBoundingClientRect();
    const scroller = frame.querySelector(".pui-data-table__scroller");
    const mobile = frame.querySelector(".pui-data-table__mobile");
    const surface = frame.querySelector(".pui-data-table__empty-scroller")
      ?? (getComputedStyle(scroller).display === "none" ? mobile : scroller);
    const surfaceStyle = getComputedStyle(surface);
    const pager = frame.querySelector(".pui-data-table__pagination");
    const pagination = pager?.querySelector(".pui-pagination");
    const tableHeaders = [...frame.querySelectorAll("table thead th")].map((header) => header.getBoundingClientRect().width);
    return {
      width: frameRect.width,
      frameRadii: [frameStyle.borderTopLeftRadius, frameStyle.borderTopRightRadius, frameStyle.borderBottomRightRadius, frameStyle.borderBottomLeftRadius],
      frameBorders: [frameStyle.borderTopWidth, frameStyle.borderRightWidth, frameStyle.borderBottomWidth, frameStyle.borderLeftWidth],
      frameOverflow: [frameStyle.overflowX, frameStyle.overflowY],
      surfaceRadii: [surfaceStyle.borderTopLeftRadius, surfaceStyle.borderTopRightRadius, surfaceStyle.borderBottomRightRadius, surfaceStyle.borderBottomLeftRadius],
      marker: frame.classList.contains("pui-data-table__frame--paginated"),
      fixedViewport: frame.classList.contains("pui-data-table__frame--fixed-viewport"),
      pager: pager ? {
        left: pager.getBoundingClientRect().left,
        right: pager.getBoundingClientRect().right,
        top: pager.getBoundingClientRect().top,
        bottom: pager.getBoundingClientRect().bottom,
        topBorder: getComputedStyle(pager).borderTopWidth,
        bottomRadii: [getComputedStyle(pager).borderBottomRightRadius, getComputedStyle(pager).borderBottomLeftRadius],
        paginationTopBorder: getComputedStyle(pagination).borderTopWidth,
      } : null,
      frame: { left: frameRect.left, right: frameRect.right, top: frameRect.top, bottom: frameRect.bottom, height: frameRect.height },
      surface: {
        left: surface.getBoundingClientRect().left,
        right: surface.getBoundingClientRect().right,
        top: surface.getBoundingClientRect().top,
        bottom: surface.getBoundingClientRect().bottom,
        height: surface.getBoundingClientRect().height,
        clientWidth: surface.clientWidth,
        gutterWidth: surface.offsetWidth - surface.clientWidth,
        scrollbarGutter: surfaceStyle.scrollbarGutter,
        role: surface.getAttribute("role"),
        tabIndex: surface.tabIndex,
      },
      tableHeaders,
    };
  });
  assert.ok(geometry.width > 0, `${label}: surface collapsed`);
  assert.deepEqual(geometry.frameRadii, ["12px", "12px", "12px", "12px"], `${label}: four frame corners differ`);
  assert.deepEqual(geometry.frameBorders, ["1px", "1px", "1px", "1px"], `${label}: frame outline incomplete`);
  assert.deepEqual(geometry.frameOverflow, ["hidden", "hidden"], `${label}: frame does not clip scrollbars and row surfaces to its rounded corners`);
  assert.equal(geometry.marker, paginated, `${label}: pagination mode marker differs`);
  assert.deepEqual(geometry.surfaceRadii, paginated ? ["11px", "11px", "0px", "0px"] : ["11px", "11px", "11px", "11px"], `${label}: inner corners differ`);
  assert.ok(Math.abs(geometry.surface.left - (geometry.frame.left + 1)) <= 1, `${label}: surface left edge detached`);
  assert.ok(Math.abs(geometry.surface.right - (geometry.frame.right - 1)) <= 1, `${label}: surface right edge detached`);
  if (geometry.fixedViewport) assert.match(geometry.surface.scrollbarGutter, /stable/, `${label}: fixed viewport does not reserve a stable scrollbar gutter`);
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
  if (empty) {
    assert.equal(await table.locator(".pui-empty").count(), 1, `${label}: empty state missing`);
    assert.equal(geometry.surface.role, "region", `${label}: fixed empty state has no scroll-region semantics`);
    assert.equal(geometry.surface.tabIndex, 0, `${label}: fixed empty state is not keyboard focusable`);
  }
  return geometry;
}

try {
  await server.listen();
  const url = server.resolvedUrls?.local?.[0];
  assert.ok(url, "Vite did not expose a local URL");
  const widths = process.env.PERSONAL_UI_TABLE_WIDTHS
    ? process.env.PERSONAL_UI_TABLE_WIDTHS.split(",").map(Number).filter((width) => Number.isFinite(width) && width > 0)
    : [2560, 1440, 1024, 736, 360, 320];
  assert.ok(widths.length > 0, "PERSONAL_UI_TABLE_WIDTHS did not contain a valid viewport width");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PERSONAL_UI_CHROMIUM_EXECUTABLE }
      : {}),
  });

  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url);
      const table = page.locator(".pui-data-page .pui-data-table");
      const surfaceSelector = width <= 640
        ? ".pui-data-page .pui-data-table__mobile"
        : ".pui-data-page .pui-data-table__scroller";
      const surface = page.locator(surfaceSelector);
      const scenario = page.getByRole("group", { name: "选择下一次查询响应" });
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      const initialLoading = await assertRounded(table, `initial loading ${width}px`, { paginated: true });
      const rowSelector = width <= 640 ? ".pui-mobile-data-row:first-child" : "tbody tr:first-child";
      const initialLoadingRowHeight = await surface.locator(rowSelector).evaluate((element) => element.getBoundingClientRect().height);
      await table.getByText("正在加载数据", { exact: true }).waitFor();
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      const ready = await assertRounded(table, `ready ${width}px`, { paginated: true });
      const readyRowHeight = await surface.locator(rowSelector).evaluate((element) => element.getBoundingClientRect().height);
      const readyScrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(Math.abs(initialLoading.surface.height - ready.surface.height) <= 1, `initial loading changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(initialLoading.frame.height - ready.frame.height) <= 1, `initial loading changed the table frame at ${width}px`);
      assert.ok(Math.abs(initialLoadingRowHeight - (width <= 640 ? 76 : 58)) <= 1, `loading row differs from the standard row-height unit at ${width}px`);
      assert.ok(Math.abs(readyRowHeight - initialLoadingRowHeight) <= 1, `ready row height differs from its loading skeleton at ${width}px`);
      assert.equal(ready.fixedViewport, true, `paginated table did not enable its stable viewport at ${width}px`);
      assert.ok(readyScrolling.scrollHeight <= readyScrolling.clientHeight + 1, `ready result unexpectedly started with a vertical scrollbar at ${width}px`);
      if (width > 640) await assertDesktopGutterPaint(page, table, `ready ${width}px`);
      const lastRow = surface.locator(width <= 640 ? ".pui-mobile-data-row:last-child" : "tbody tr:last-child td:last-child");
      assert.equal(await lastRow.evaluate((element) => getComputedStyle(element).borderBottomWidth), "0px", `double bottom line at ${width}px`);
      const readyHeight = ready.surface.height;

      await table.getByRole("combobox", { name: "每页数量" }).click();
      await page.getByRole("option", { name: "20 条" }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      const largePage = await assertRounded(table, `large page ready ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - largePage.surface.height) <= 1, `page size changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - largePage.frame.height) <= 1, `page size changed the table frame at ${width}px`);
      await table.getByText("1-20 / 共 23 条", { exact: true }).waitFor();
      const scrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(scrolling.scrollHeight > scrolling.clientHeight, `large page did not scroll inside the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.surface.clientWidth - largePage.surface.clientWidth) <= 1, `vertical scrollbar changed the table content width at ${width}px`);
      assert.ok(Math.abs(ready.surface.gutterWidth - largePage.surface.gutterWidth) <= 1, `vertical scrollbar changed the reserved gutter width at ${width}px`);
      if (width > 640) {
        assert.equal(ready.tableHeaders.length, largePage.tableHeaders.length, `vertical scrollbar changed the visible column count at ${width}px`);
        ready.tableHeaders.forEach((headerWidth, index) => {
          assert.ok(Math.abs(headerWidth - largePage.tableHeaders[index]) <= 1, `vertical scrollbar changed column ${index + 1} width at ${width}px`);
        });
      }
      if (process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX && [1440, 320].includes(width)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX}-scrolling-${width}.png`, fullPage: true });
      }

      await page.getByRole("button", { name: "查询", exact: true }).focus();
      await page.keyboard.press("Tab");
      const focusContract = await surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          active: document.activeElement === element,
          focusVisible: element.matches(":focus-visible"),
          role: element.getAttribute("role"),
          label: element.getAttribute("aria-label"),
          tabIndex: element.tabIndex,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineOffset: style.outlineOffset,
        };
      });
      assert.equal(focusContract.active, true, `fixed table viewport is skipped by keyboard focus at ${width}px`);
      assert.equal(focusContract.focusVisible, true, `fixed table viewport has no keyboard focus state at ${width}px`);
      assert.equal(focusContract.tabIndex, 0, `fixed table viewport has the wrong tab index at ${width}px`);
      assert.equal(focusContract.role, width <= 640 ? "list" : "region", `fixed table viewport has the wrong semantic role at ${width}px`);
      assert.equal(focusContract.label, width <= 640 ? "成员数据移动版" : "成员数据滚动区域", `fixed table viewport has no useful accessible name at ${width}px`);
      assert.equal(focusContract.outlineStyle, "solid", `fixed table viewport focus outline is missing at ${width}px`);
      assert.ok(parseFloat(focusContract.outlineWidth) >= 2, `fixed table viewport focus outline is too thin at ${width}px`);
      assert.equal(focusContract.outlineOffset, "-2px", `fixed table viewport focus outline is not inset at ${width}px`);

      await surface.evaluate((element) => { element.scrollTop = 0; });
      const pageScrollBeforeKeyboard = await settledWindowScroll(page);
      await surface.press("ArrowDown");
      const arrowScrollTop = await settledScrollTop(surface, 0);
      assert.ok(arrowScrollTop > 0, `ArrowDown did not scroll the fixed table viewport at ${width}px`);
      await surface.press("PageDown");
      const pageDownScrollTop = await settledScrollTop(surface, arrowScrollTop);
      assert.ok(pageDownScrollTop - arrowScrollTop >= scrolling.clientHeight * 0.5, `PageDown did not move the fixed table viewport by a page at ${width}px`);
      assert.ok(Math.abs((await settledWindowScroll(page)) - pageScrollBeforeKeyboard) <= 1, `table keyboard scrolling moved the page at ${width}px`);

      const beforePageSizeReset = await surface.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return { scrollTop: element.scrollTop, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
      });
      assert.ok(beforePageSizeReset.scrollTop > 0, `could not prepare the table scroll reset case at ${width}px`);
      await table.getByRole("combobox", { name: "每页数量" }).click();
      await page.getByRole("option", { name: "50 条" }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      const loadingScroll = await surface.evaluate((element) => ({
        scrollTop: element.scrollTop,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      assert.ok(loadingScroll.scrollHeight - loadingScroll.clientHeight >= beforePageSizeReset.scrollTop - 1, `loading content shrank and could mask scroll reset at ${width}px`);
      assert.ok(loadingScroll.scrollTop <= 1, `table did not reset to the top when the page-size request started at ${width}px`);
      const largestPageLoading = await assertRounded(table, `50-row loading ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - largestPageLoading.surface.height) <= 1, `50-row loading changed the fixed viewport at ${width}px`);
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      await table.getByText("1-23 / 共 23 条", { exact: true }).waitFor();
      const largestPage = await assertRounded(table, `50-row ready ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - largestPage.surface.height) <= 1, `50-row ready changed the fixed viewport at ${width}px`);
      assert.ok(await surface.evaluate((element) => element.scrollTop) <= 1, `table did not remain at the top after page-size data changed at ${width}px`);
      const largestScrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(largestScrolling.scrollHeight > largestScrolling.clientHeight, `50-row option did not keep overflow inside the table at ${width}px`);

      await page.getByRole("searchbox", { name: "搜索姓名或邮箱" }).fill("ning");
      await page.getByRole("button", { name: "查询", exact: true }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      const sparseLoading = await assertRounded(table, `sparse loading ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - sparseLoading.surface.height) <= 1, `query loading changed table height at ${width}px`);
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      const sparse = await assertRounded(table, `sparse ready ${width}px`, { paginated: true });
      assert.equal(await surface.locator(width <= 640 ? ".pui-mobile-data-row" : "tbody tr").count(), 2, `sparse query did not render two rows at ${width}px`);
      assert.equal(await table.locator(".pui-data-table__pagination").count(), 1, `sparse query removed pagination at ${width}px`);
      await table.getByText("1-2 / 共 2 条", { exact: true }).waitFor();
      const sparseScrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(sparseScrolling.scrollHeight <= sparseScrolling.clientHeight + 1, `sparse results unexpectedly kept a vertical scrollbar at ${width}px`);
      if (width > 640) await assertDesktopGutterPaint(page, table, `sparse ready ${width}px`);
      assert.ok(Math.abs(ready.surface.height - sparse.surface.height) <= 1, `sparse ready result changed table height at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - sparse.frame.height) <= 1, `sparse ready result changed frame height at ${width}px`);
      assert.ok(Math.abs(largestPage.surface.clientWidth - sparse.surface.clientWidth) <= 1, `sparse results changed the reserved scrollbar width at ${width}px`);
      const sparseLastRowCells = surface.locator(width <= 640 ? ".pui-mobile-data-row:last-child" : ":scope > table > tbody > tr:last-child > td");
      const sparseLastRowBorders = await sparseLastRowCells.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).borderBottomWidth));
      assert.ok(sparseLastRowBorders.length > 0, `sparse result last row missing at ${width}px`);
      assert.ok(sparseLastRowBorders.every((widthValue) => widthValue === "1px"), `sparse result last-row divider incomplete at ${width}px`);
      if (width > 640) {
        assert.equal(largestPage.tableHeaders.length, sparse.tableHeaders.length, `sparse results changed the visible column count at ${width}px`);
        largestPage.tableHeaders.forEach((headerWidth, index) => {
          assert.ok(Math.abs(headerWidth - sparse.tableHeaders[index]) <= 1, `sparse results changed column ${index + 1} width at ${width}px`);
        });
      }
      const readyPagerOffset = ready.pager.top - ready.frame.top;
      const sparsePagerOffset = sparse.pager.top - sparse.frame.top;
      assert.ok(Math.abs(readyPagerOffset - sparsePagerOffset) <= 1, `sparse ready result moved pagination within the table at ${width}px`);
      if (process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX && [1440, 320].includes(width)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX}-sparse-${width}.png`, fullPage: true });
      }

      await page.getByRole("button", { name: "重置", exact: true }).click();
      await page.getByRole("button", { name: "查询", exact: true }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      await page.locator('.pui-data-page .pui-data-table[data-state="ready"]').waitFor();
      await table.getByText("1-23 / 共 23 条", { exact: true }).waitFor();

      await scenario.getByRole("button", { name: "空结果" }).click();
      await page.getByRole("button", { name: "查询", exact: true }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="loading"]').waitFor();
      await assertRounded(table, `loading ${width}px`, { paginated: true });
      const loadingHeight = await surface.evaluate((element) => element.getBoundingClientRect().height);
      assert.ok(Math.abs(readyHeight - loadingHeight) <= 1, `table resized while loading at ${width}px`);
      await page.locator('.pui-data-page .pui-data-table[data-state="empty"]').waitFor();
      const empty = await assertRounded(table, `empty ${width}px`, { paginated: true, empty: true });
      await table.getByText("0 条结果", { exact: true }).waitFor();
      assert.ok(Math.abs(ready.surface.height - empty.surface.height) <= 1, `empty result changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - empty.frame.height) <= 1, `empty result changed the table frame at ${width}px`);
      assert.ok(Math.abs((ready.pager.top - ready.frame.top) - (empty.pager.top - empty.frame.top)) <= 1, `empty result moved pagination within the table at ${width}px`);

      const emptyFrame = table.locator(".pui-data-table__frame");
      const originalViewportHeights = await emptyFrame.evaluate((element) => {
        const original = {
          desktop: element.style.getPropertyValue("--pui-data-table-desktop-viewport-height"),
          mobile: element.style.getPropertyValue("--pui-data-table-mobile-viewport-height"),
        };
        element.style.setProperty("--pui-data-table-desktop-viewport-height", "100px");
        element.style.setProperty("--pui-data-table-mobile-viewport-height", "76px");
        return original;
      });
      const emptyScroller = table.locator(".pui-data-table__empty-scroller");
      const compactEmpty = await emptyScroller.evaluate((element) => {
        element.scrollTop = 0;
        element.focus();
        return { active: document.activeElement === element, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
      });
      assert.equal(compactEmpty.active, true, `compact fixed empty viewport cannot receive focus at ${width}px`);
      assert.ok(compactEmpty.scrollHeight > compactEmpty.clientHeight, `compact fixed empty viewport did not create the overflow test case at ${width}px`);
      await emptyScroller.press("PageDown");
      assert.ok(await settledScrollTop(emptyScroller, 0) > 0, `compact fixed empty viewport cannot be scrolled by keyboard at ${width}px`);
      await emptyFrame.evaluate((element, original) => {
        element.style.setProperty("--pui-data-table-desktop-viewport-height", original.desktop);
        element.style.setProperty("--pui-data-table-mobile-viewport-height", original.mobile);
      }, originalViewportHeights);

      await scenario.getByRole("button", { name: "请求失败" }).click();
      await table.getByRole("button", { name: "查看全部成员" }).click();
      await page.locator('.pui-data-page .pui-data-table[data-state="error"]').waitFor();
      const zeroRowError = await assertRounded(table, `zero-row error ${width}px`, { paginated: true });
      await table.getByText("暂无缓存数据", { exact: true }).waitFor();
      assert.ok(Math.abs(ready.surface.height - zeroRowError.surface.height) <= 1, `zero-row error changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - zeroRowError.frame.height) <= 1, `zero-row error changed the table frame at ${width}px`);

      await scenario.getByRole("button", { name: "正常返回" }).click();
      await table.getByRole("button", { name: "重试", exact: true }).click();
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
  console.log(`DataTable rounded and stable-height ready/loading/sparse/empty/error regression passed at ${widths.map((width) => `${width}px`).join(", ")}.`);
} finally {
  await browser?.close();
  await server.close();
}
