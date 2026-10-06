import assert from "node:assert/strict";
import { isPersonalUiRegressionMain, runPersonalUiRegression } from "./browser-test-harness.mjs";
import { legacyExplorerCaseTabs, selectExplorerCase } from "./browser-explorer-case.mjs";

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

async function assertRowsFitSurface(surface, rowSelector, label) {
  const geometry = await surface.evaluate((element, selector) => {
    const surfaceRect = element.getBoundingClientRect();
    const rows = [...element.querySelectorAll(selector)];
    const firstRowRect = rows[0]?.getBoundingClientRect();
    const lastRowRect = rows.at(-1)?.getBoundingClientRect();
    return {
      rowCount: rows.length,
      surface: { top: surfaceRect.top, bottom: surfaceRect.bottom },
      firstRowTop: firstRowRect?.top,
      lastRowBottom: lastRowRect?.bottom,
    };
  }, rowSelector);
  assert.ok(geometry.rowCount > 0, `${label}: no rendered rows found`);
  assert.ok(geometry.firstRowTop >= geometry.surface.top - 1, `${label}: first row starts above the table surface`);
  assert.ok(geometry.lastRowBottom <= geometry.surface.bottom + 1, `${label}: rendered rows overflow the fixed table surface`);
}

async function captureLoadingGeometry(casePanel, surfaceSelector, rowSelector) {
  return casePanel.evaluate((panel, selectors) => new Promise((resolve, reject) => {
    const deadline = performance.now() + 5_000;
    const sample = () => {
      const table = panel.querySelector('.pui-data-page .pui-data-table[data-state="loading"]');
      const frame = table?.querySelector('.pui-data-table__frame');
      const surface = table?.querySelector(selectors.surface);
      const row = surface?.querySelector(selectors.row);
      if (frame && surface && row) {
        const frameStyle = getComputedStyle(frame);
        const surfaceStyle = getComputedStyle(surface);
        const frameRect = frame.getBoundingClientRect();
        const surfaceRect = surface.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const pager = frame.querySelector('.pui-data-table__pagination');
        const pagination = pager?.querySelector('.pui-pagination');
        resolve({
          width: frameRect.width,
          frameRadii: [frameStyle.borderTopLeftRadius, frameStyle.borderTopRightRadius, frameStyle.borderBottomRightRadius, frameStyle.borderBottomLeftRadius],
          frameBorders: [frameStyle.borderTopWidth, frameStyle.borderRightWidth, frameStyle.borderBottomWidth, frameStyle.borderLeftWidth],
          frameOverflow: [frameStyle.overflowX, frameStyle.overflowY],
          surfaceRadii: [surfaceStyle.borderTopLeftRadius, surfaceStyle.borderTopRightRadius, surfaceStyle.borderBottomRightRadius, surfaceStyle.borderBottomLeftRadius],
          marker: frame.classList.contains('pui-data-table__frame--paginated'),
          fixedViewport: frame.classList.contains('pui-data-table__frame--fixed-viewport'),
          pager: pager ? {
            left: pager.getBoundingClientRect().left,
            right: pager.getBoundingClientRect().right,
            top: pager.getBoundingClientRect().top,
            bottom: pager.getBoundingClientRect().bottom,
            topBorder: getComputedStyle(pager).borderTopWidth,
            bottomRadii: [getComputedStyle(pager).borderBottomRightRadius, getComputedStyle(pager).borderBottomLeftRadius],
            paginationTopBorder: getComputedStyle(pagination).borderTopWidth,
          } : null,
          frame: {
            left: frameRect.left,
            right: frameRect.right,
            top: frameRect.top,
            bottom: frameRect.bottom,
            height: frameRect.height,
          },
          surface: {
            left: surfaceRect.left,
            right: surfaceRect.right,
            top: surfaceRect.top,
            bottom: surfaceRect.bottom,
            height: surfaceRect.height,
            scrollTop: surface.scrollTop,
            clientHeight: surface.clientHeight,
            scrollHeight: surface.scrollHeight,
            scrollbarGutter: surfaceStyle.scrollbarGutter,
            role: surface.getAttribute('role'),
            tabIndex: surface.tabIndex,
          },
          tableHeaders: [...frame.querySelectorAll('table thead th')].map((header) => header.getBoundingClientRect().width),
          rowHeight: rowRect.height,
        });
        return;
      }
      if (performance.now() >= deadline) {
        reject(new Error('Timed out before the table exposed a measurable loading row'));
        return;
      }
      requestAnimationFrame(sample);
    };
    sample();
  }), { surface: surfaceSelector, row: rowSelector });
}

async function assertDesktopBandLayout(table, label) {
  const contract = await table.evaluate((element) => {
    const surface = element.querySelector(".pui-data-table__scroller");
    const header = surface.querySelector("thead th:last-child");
    const surfaceRect = surface.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const surfaceStyle = getComputedStyle(surface);
    const headerStyle = getComputedStyle(header);
    return {
      scrollbarGutter: surfaceStyle.scrollbarGutter,
      backgroundImage: surfaceStyle.backgroundImage,
      headerHeight: headerRect.height,
      headerTopDelta: headerRect.top - surfaceRect.top,
      headerPosition: headerStyle.position,
      headerInset: headerStyle.top,
    };
  });
  assert.match(contract.scrollbarGutter, /stable/, `${label}: stable scrollbar-gutter contract is missing`);
  assert.match(contract.backgroundImage, /linear-gradient/i, `${label}: table bands do not continue behind the scrollbar area`);
  assert.ok(Math.abs(contract.headerHeight - 42) <= 1, `${label}: header height changed`);
  assert.ok(Math.abs(contract.headerTopDelta) <= 1, `${label}: header is detached from the top of the table surface`);
  assert.equal(contract.headerPosition, "sticky", `${label}: table header is not sticky`);
  assert.equal(contract.headerInset, "0px", `${label}: sticky table header has the wrong inset`);
}

async function assertDesktopScrollableHeaderLayout(table, label) {
  const contract = await table.evaluate(async (element) => {
    const surface = element.querySelector(".pui-data-table__scroller");
    const header = surface.querySelector("thead th:last-child");
    const surfaceRect = surface.getBoundingClientRect();
    const headerRectBefore = header.getBoundingClientRect();
    const firstRow = surface.querySelector("tbody tr:first-child");
    const firstRowTopBefore = firstRow.getBoundingClientRect().top;
    const maxScrollTop = surface.scrollHeight - surface.clientHeight;
    surface.scrollTop = Math.min(maxScrollTop, 84);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const headerRectAfter = header.getBoundingClientRect();
    const firstRowTopAfter = firstRow.getBoundingClientRect().top;
    const surfaceStyle = getComputedStyle(surface);
    const headerStyle = getComputedStyle(header);
    surface.scrollTop = 0;
    return {
      maxScrollTop,
      actualScrollTop: firstRowTopBefore - firstRowTopAfter,
      headerHeight: headerRectBefore.height,
      headerOffset: surfaceStyle.getPropertyValue("--_pui-data-table-header-height").trim(),
      scrollbarGutter: surfaceStyle.scrollbarGutter,
      backgroundImage: surfaceStyle.backgroundImage,
      headerPosition: headerStyle.position,
      headerInset: headerStyle.top,
      headerTopBefore: headerRectBefore.top,
      headerTopAfter: headerRectAfter.top,
      surfaceTop: surfaceRect.top,
    };
  });
  assert.ok(contract.maxScrollTop > 0, `${label}: vertical overflow test case is missing`);
  assert.ok(contract.actualScrollTop > 0, `${label}: rows did not move within the scrolling table surface`);
  assert.ok(Math.abs(contract.headerHeight - 42) <= 1, `${label}: header height changed`);
  assert.equal(contract.headerOffset, "42px", `${label}: scrollbar offset does not match the header height`);
  assert.match(contract.scrollbarGutter, /stable/, `${label}: stable scrollbar-gutter contract is missing`);
  assert.match(contract.backgroundImage, /linear-gradient/i, `${label}: header/body bands do not continue behind the scrollbar area`);
  assert.equal(contract.headerPosition, "sticky", `${label}: table header is not sticky`);
  assert.equal(contract.headerInset, "0px", `${label}: sticky table header has the wrong inset`);
  assert.ok(Math.abs(contract.headerTopBefore - contract.surfaceTop) <= 1, `${label}: table header did not start at the surface edge`);
  assert.ok(Math.abs(contract.headerTopAfter - contract.surfaceTop) <= 1, `${label}: table header moved while rows scrolled`);
}

async function assertMobileScrollbarHasNoHeaderOffset(surface, label) {
  const contract = await surface.evaluate((element) => ({
    headerOffset: getComputedStyle(element).getPropertyValue("--_pui-data-table-header-height").trim(),
    scrollbarGutter: getComputedStyle(element).scrollbarGutter,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert.equal(contract.headerOffset, "", `${label}: desktop header offset leaked into the mobile list`);
  assert.match(contract.scrollbarGutter, /stable/, `${label}: mobile list lost its stable scrollbar-gutter contract`);
  assert.equal(contract.overflowY, "auto", `${label}: mobile list is not the vertical scrolling owner`);
}

function assertDesktopColumnLayout(baseline, current, label) {
  assert.equal(current.length, baseline.length, `${label}: visible column count changed`);
  assert.equal(current.length, 6, `${label}: demo column contract changed`);
  for (const [index, minimum] of [[0, 224], [1, 108]]) {
    assert.ok(baseline[index] >= minimum - 1, `${label}: baseline flexible column ${index + 1} fell below its minimum width`);
    assert.ok(current[index] >= minimum - 1, `${label}: flexible column ${index + 1} fell below its minimum width`);
  }
  for (const [index, width] of [[2, 132], [3, 132], [4, 160], [5, 72]]) {
    assert.ok(Math.abs(baseline[index] - width) <= 1, `${label}: baseline fixed column ${index + 1} drifted from ${width}px`);
    assert.ok(Math.abs(current[index] - width) <= 1, `${label}: fixed column ${index + 1} drifted from ${width}px`);
  }
}

function assertRoundedGeometry(geometry, label, { paginated }) {
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
        scrollbarGutter: surfaceStyle.scrollbarGutter,
        role: surface.getAttribute("role"),
        tabIndex: surface.tabIndex,
      },
      tableHeaders,
    };
  });
  assertRoundedGeometry(geometry, label, { paginated });
  if (empty) {
    assert.equal(await table.locator(".pui-empty").count(), 1, `${label}: empty state missing`);
    assert.equal(geometry.surface.role, "region", `${label}: fixed empty state has no scroll-region semantics`);
    assert.equal(geometry.surface.tabIndex, 0, `${label}: fixed empty state is not keyboard focusable`);
  }
  return geometry;
}

export async function runDataTableRoundedRegression({ page, baseURL }) {
  assert.ok(baseURL, "A baseURL is required");
  const widths = process.env.PERSONAL_UI_TABLE_WIDTHS
    ? process.env.PERSONAL_UI_TABLE_WIDTHS.split(",").map(Number).filter((width) => Number.isFinite(width) && width > 0)
    : [2560, 1440, 1024, 736, 360, 320];
  assert.ok(widths.length > 0, "PERSONAL_UI_TABLE_WIDTHS did not contain a valid viewport width");

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseURL}/?regressionWidth=${width}#/patterns/list-filter`);
      const casePanel = await selectExplorerCase(page, legacyExplorerCaseTabs.listFilter);
      const table = casePanel.locator(".pui-data-page .pui-data-table");
      const surfaceSelector = width <= 640
        ? ".pui-data-page .pui-data-table__mobile"
        : ".pui-data-page .pui-data-table__scroller";
      const surface = casePanel.locator(surfaceSelector);
      const scenario = casePanel.getByRole("group", { name: "选择下一次查询响应" });
      const tableState = (state) => casePanel.locator(`.pui-data-page .pui-data-table[data-state="${state}"]`);
      const rowSelector = width <= 640 ? ".pui-mobile-data-row:first-child" : "tbody tr:first-child";
      await tableState("ready").waitFor();
      const ready = await assertRounded(table, `ready ${width}px`, { paginated: true });
      const readyRowHeight = await surface.locator(rowSelector).evaluate((element) => element.getBoundingClientRect().height);
      assert.equal(ready.fixedViewport, true, `paginated table did not enable its stable viewport at ${width}px`);
      await assertRowsFitSurface(surface, rowSelector, `ready ${width}px`);
      if (width > 640) await assertDesktopBandLayout(table, `ready ${width}px`);
      const lastRow = surface.locator(width <= 640 ? ".pui-mobile-data-row:last-child" : "tbody tr:last-child td:last-child");
      assert.equal(await lastRow.evaluate((element) => getComputedStyle(element).borderBottomWidth), "0px", `double bottom line at ${width}px`);
      const readyHeight = ready.surface.height;

      const [explicitLoading] = await Promise.all([
        captureLoadingGeometry(
          casePanel,
          width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller",
          rowSelector,
        ),
        casePanel.getByRole("button", { name: "查询", exact: true }).click(),
      ]);
      assertRoundedGeometry(explicitLoading, `explicit loading ${width}px`, { paginated: true });
      const loadingRowHeight = explicitLoading.rowHeight;
      assert.ok(Math.abs(explicitLoading.surface.height - ready.surface.height) <= 1, `loading changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(explicitLoading.frame.height - ready.frame.height) <= 1, `loading changed the table frame at ${width}px`);
      assert.ok(
        Math.abs(loadingRowHeight - (width <= 640 ? 76 : 58)) <= 1,
        `loading row differs from the standard row-height unit at ${width}px (${loadingRowHeight}px)`,
      );
      await tableState("ready").waitFor();
      const refreshedRowHeight = await surface.locator(rowSelector).evaluate((element) => element.getBoundingClientRect().height);
      assert.ok(Math.abs(refreshedRowHeight - loadingRowHeight) <= 1, `ready row height differs from its loading skeleton at ${width}px`);
      assert.ok(Math.abs(refreshedRowHeight - readyRowHeight) <= 1, `refresh changed the standard row-height unit at ${width}px`);

      await table.getByRole("combobox", { name: "每页数量" }).click();
      await Promise.all([
        captureLoadingGeometry(casePanel, width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller", rowSelector),
        page.getByRole("option", { name: "20 条" }).click(),
      ]);
      await tableState("ready").waitFor();
      const largePage = await assertRounded(table, `large page ready ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - largePage.surface.height) <= 1, `page size changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - largePage.frame.height) <= 1, `page size changed the table frame at ${width}px`);
      await table.getByText("1-20 / 23 条结果", { exact: true }).waitFor();
      const scrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(scrolling.scrollHeight > scrolling.clientHeight, `large page did not scroll inside the fixed viewport at ${width}px`);
      assert.ok(Math.abs((ready.surface.right - ready.surface.left) - (largePage.surface.right - largePage.surface.left)) <= 1, `vertical scrollbar changed the table surface width at ${width}px (${ready.surface.right - ready.surface.left} -> ${largePage.surface.right - largePage.surface.left})`);
      assert.ok(Math.abs(ready.width - largePage.width) <= 1, `vertical scrollbar changed the table frame width at ${width}px (${ready.width} -> ${largePage.width})`);
      if (width > 640) {
        await assertDesktopScrollableHeaderLayout(table, `large page ready ${width}px`);
      } else {
        await assertMobileScrollbarHasNoHeaderOffset(surface, `large page ready ${width}px`);
      }
      if (width > 640) {
        assertDesktopColumnLayout(ready.tableHeaders, largePage.tableHeaders, `vertical scrollbar at ${width}px`);
      }
      if (process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX && [1440, 320].includes(width)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX}-scrolling-${width}.png`, fullPage: true });
      }

      await casePanel.getByRole("button", { name: "查询", exact: true }).focus();
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
      const [pageSizeLoading] = await Promise.all([
        captureLoadingGeometry(casePanel, width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller", rowSelector),
        page.getByRole("option", { name: "50 条" }).click(),
      ]);
      const loadingScroll = pageSizeLoading.surface;
      assert.ok(loadingScroll.scrollHeight - loadingScroll.clientHeight >= beforePageSizeReset.scrollTop - 1, `loading content shrank and could mask scroll reset at ${width}px`);
      assert.ok(loadingScroll.scrollTop <= 1, `table did not reset to the top when the page-size request started at ${width}px`);
      assertRoundedGeometry(pageSizeLoading, `50-row loading ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - pageSizeLoading.surface.height) <= 1, `50-row loading changed the fixed viewport at ${width}px`);
      await tableState("ready").waitFor();
      await table.getByText("1-23 / 23 条结果", { exact: true }).waitFor();
      const largestPage = await assertRounded(table, `50-row ready ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - largestPage.surface.height) <= 1, `50-row ready changed the fixed viewport at ${width}px`);
      assert.ok(await surface.evaluate((element) => element.scrollTop) <= 1, `table did not remain at the top after page-size data changed at ${width}px`);
      const largestScrolling = await surface.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      assert.ok(largestScrolling.scrollHeight > largestScrolling.clientHeight, `50-row option did not keep overflow inside the table at ${width}px`);

      await casePanel.getByRole("searchbox", { name: "搜索姓名或邮箱" }).fill("ning");
      const [sparseLoading] = await Promise.all([
        captureLoadingGeometry(casePanel, width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller", rowSelector),
        casePanel.getByRole("button", { name: "查询", exact: true }).click(),
      ]);
      assertRoundedGeometry(sparseLoading, `sparse loading ${width}px`, { paginated: true });
      assert.ok(Math.abs(ready.surface.height - sparseLoading.surface.height) <= 1, `query loading changed table height at ${width}px`);
      await tableState("ready").waitFor();
      const sparse = await assertRounded(table, `sparse ready ${width}px`, { paginated: true });
      assert.equal(await surface.locator(width <= 640 ? ".pui-mobile-data-row" : "tbody tr").count(), 2, `sparse query did not render two rows at ${width}px`);
      assert.equal(await table.locator(".pui-data-table__pagination").count(), 1, `sparse query removed pagination at ${width}px`);
      await table.getByText("1-2 / 2 条结果", { exact: true }).waitFor();
      await assertRowsFitSurface(surface, width <= 640 ? ".pui-mobile-data-row" : "tbody tr", `sparse ready ${width}px`);
      if (width > 640) await assertDesktopBandLayout(table, `sparse ready ${width}px`);
      assert.ok(Math.abs(ready.surface.height - sparse.surface.height) <= 1, `sparse ready result changed table height at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - sparse.frame.height) <= 1, `sparse ready result changed frame height at ${width}px`);
      assert.ok(Math.abs((largestPage.surface.right - largestPage.surface.left) - (sparse.surface.right - sparse.surface.left)) <= 1, `sparse results changed the table surface width at ${width}px (${largestPage.surface.right - largestPage.surface.left} -> ${sparse.surface.right - sparse.surface.left})`);
      assert.ok(Math.abs(largestPage.width - sparse.width) <= 1, `sparse results changed the table frame width at ${width}px (${largestPage.width} -> ${sparse.width})`);
      const sparseLastRowCells = surface.locator(width <= 640 ? ".pui-mobile-data-row:last-child" : ":scope > table > tbody > tr:last-child > td");
      const sparseLastRowBorders = await sparseLastRowCells.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).borderBottomWidth));
      assert.ok(sparseLastRowBorders.length > 0, `sparse result last row missing at ${width}px`);
      assert.ok(sparseLastRowBorders.every((widthValue) => widthValue === "1px"), `sparse result last-row divider incomplete at ${width}px`);
      if (width > 640) {
        assertDesktopColumnLayout(largestPage.tableHeaders, sparse.tableHeaders, `sparse results at ${width}px`);
      }
      const readyPagerOffset = ready.pager.top - ready.frame.top;
      const sparsePagerOffset = sparse.pager.top - sparse.frame.top;
      assert.ok(Math.abs(readyPagerOffset - sparsePagerOffset) <= 1, `sparse ready result moved pagination within the table at ${width}px`);
      if (process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX && [1440, 320].includes(width)) {
        await page.screenshot({ path: `${process.env.PERSONAL_UI_TABLE_SCREENSHOT_PREFIX}-sparse-${width}.png`, fullPage: true });
      }

      await casePanel.getByRole("button", { name: "重置", exact: true }).click();
      await Promise.all([
        captureLoadingGeometry(casePanel, width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller", rowSelector),
        casePanel.getByRole("button", { name: "查询", exact: true }).click(),
      ]);
      await tableState("ready").waitFor();
      await table.getByText("1-23 / 23 条结果", { exact: true }).waitFor();

      await scenario.getByRole("button", { name: "空结果" }).click();
      const [emptyLoading] = await Promise.all([
        captureLoadingGeometry(casePanel, width <= 640 ? ".pui-data-table__mobile" : ".pui-data-table__scroller", rowSelector),
        casePanel.getByRole("button", { name: "查询", exact: true }).click(),
      ]);
      assertRoundedGeometry(emptyLoading, `loading ${width}px`, { paginated: true });
      const loadingHeight = emptyLoading.surface.height;
      assert.ok(Math.abs(readyHeight - loadingHeight) <= 1, `table resized while loading at ${width}px`);
      await tableState("empty").waitFor();
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
      await tableState("error").waitFor();
      const zeroRowError = await assertRounded(table, `zero-row error ${width}px`, { paginated: true });
      await table.getByText("暂无缓存数据", { exact: true }).waitFor();
      assert.ok(Math.abs(ready.surface.height - zeroRowError.surface.height) <= 1, `zero-row error changed the fixed viewport at ${width}px`);
      assert.ok(Math.abs(ready.frame.height - zeroRowError.frame.height) <= 1, `zero-row error changed the table frame at ${width}px`);

      await scenario.getByRole("button", { name: "正常返回" }).click();
      await table.getByRole("button", { name: "重试", exact: true }).click();
      await tableState("ready").waitFor();
      await assertRounded(table, `recovered ${width}px`, { paginated: true });
      await scenario.getByRole("button", { name: "请求失败" }).click();
      await casePanel.getByRole("button", { name: "查询", exact: true }).click();
      await tableState("error").waitFor();
      await assertRounded(table, `error ${width}px`, { paginated: true });
      assert.equal(await table.locator(":scope > .pui-alert").count(), 1, `error alert moved inside table at ${width}px`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `horizontal overflow at ${width}px`);
  }
  console.log(`DataTable rounded and stable-height ready/loading/sparse/empty/error regression passed at ${widths.map((width) => `${width}px`).join(", ")}.`);
}

if (isPersonalUiRegressionMain(import.meta.url)) {
  await runPersonalUiRegression(runDataTableRoundedRegression);
}
