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

  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(url);
      await page.getByRole("tab", { name: "用户权限" }).click();
      const root = page.locator(".demo-list-frame .pui-list-page");
      await root.waitFor();
      const measure = () => root.evaluate((element) => {
        const container = element.getBoundingClientRect();
        const frame = element.querySelector(".pui-data-table__frame");
        const frameRect = frame.getBoundingClientRect();
        const frameStyle = getComputedStyle(frame);
        const scroller = element.querySelector(".pui-data-table__scroller");
        const mobile = element.querySelector(".pui-data-table__mobile");
        const surface = getComputedStyle(scroller).display === "none" ? mobile : scroller;
        const surfaceStyle = getComputedStyle(surface);
        const table = scroller.querySelector("table");
        const pagerWrap = frame.querySelector(".pui-data-table__pagination");
        const pagination = pagerWrap?.querySelector(".pui-pagination");
        const headers = [...table.querySelectorAll("thead th")].map((header) => header.getBoundingClientRect().width);
        const firstStatus = table.querySelector("tbody tr:first-child td:nth-child(3) .pui-tag");
        const firstAction = table.querySelector("tbody tr:first-child td:last-child");
        return {
          root: { left: container.left, right: container.right, width: container.width },
          frame: { left: frameRect.left, right: frameRect.right, top: frameRect.top, bottom: frameRect.bottom },
          frameRadii: [frameStyle.borderTopLeftRadius, frameStyle.borderTopRightRadius, frameStyle.borderBottomRightRadius, frameStyle.borderBottomLeftRadius],
          frameBorders: [frameStyle.borderTopWidth, frameStyle.borderRightWidth, frameStyle.borderBottomWidth, frameStyle.borderLeftWidth],
          paginated: frame.classList.contains("pui-data-table__frame--paginated"),
          scroller: { left: scroller.getBoundingClientRect().left, right: scroller.getBoundingClientRect().right },
          surfaceRight: surface.getBoundingClientRect().right,
          surfaceBottom: surface.getBoundingClientRect().bottom,
          surfaceRadii: [surfaceStyle.borderTopLeftRadius, surfaceStyle.borderTopRightRadius, surfaceStyle.borderBottomRightRadius, surfaceStyle.borderBottomLeftRadius],
          pager: pagerWrap ? { left: pagerWrap.getBoundingClientRect().left, right: pagerWrap.getBoundingClientRect().right, top: pagerWrap.getBoundingClientRect().top, bottom: pagerWrap.getBoundingClientRect().bottom, borderTop: getComputedStyle(pagerWrap).borderTopWidth } : null,
          paginationRight: pagination?.getBoundingClientRect().right,
          paginationWidth: pagination?.getBoundingClientRect().width,
          paginationBorder: pagination && getComputedStyle(pagination).borderTopWidth,
          nextRight: pagination?.querySelector('[aria-label="下一页"]').getBoundingClientRect().right,
          tableWidth: table.getBoundingClientRect().width,
          scrollerHeight: scroller.getBoundingClientRect().height,
          mobileHeight: mobile.getBoundingClientRect().height,
          headers,
          statusRight: firstStatus?.getBoundingClientRect().right,
          actionLeft: firstAction?.getBoundingClientRect().left,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      const ready = await measure();
      if (ready.documentWidth > ready.viewportWidth) {
        const offenders = await page.evaluate(() => [...document.querySelectorAll("*")]
          .map((element) => ({ tag: element.tagName, className: typeof element.className === "string" ? element.className : "", right: element.getBoundingClientRect().right, label: element.getAttribute("aria-label"), pagination: element.closest(".pui-pagination")?.getBoundingClientRect().toJSON(), controls: element.closest(".pui-pagination__controls")?.getBoundingClientRect().toJSON(), hidden: Boolean(element.closest("[hidden]")) }))
          .filter(({ right }) => right > window.innerWidth + 1)
          .slice(0, 12));
        assert.fail(`document overflow at ${width}px: ${JSON.stringify({ ready, offenders })}`);
      }
      assert.ok(ready.root.width <= 1161, `list page expanded beyond readable width at ${width}px`);
      assert.deepEqual(ready.frameRadii, ["12px", "12px", "12px", "12px"], `table outer corners differ at ${width}px`);
      assert.deepEqual(ready.frameBorders, ["1px", "1px", "1px", "1px"], `table outline incomplete at ${width}px`);
      assert.deepEqual(ready.surfaceRadii, ["11px", "11px", "0px", "0px"], `paged table surface corners differ at ${width}px`);
      assert.equal(ready.paginated, true, `paged table missing mode marker at ${width}px`);
      assert.ok(ready.pager, `paged table missing attached pagination at ${width}px`);
      assert.equal(ready.pager.borderTop, "1px", `table/pagination divider missing at ${width}px`);
      assert.equal(ready.paginationBorder, "0px", `pagination has duplicate divider at ${width}px`);
      assert.ok(ready.paginationWidth > 0, `pagination collapsed at ${width}px`);
      assert.ok(Math.abs(ready.surfaceRight - ready.pager.right) <= 1, `table/pagination misaligned at ${width}px: ${JSON.stringify(ready)}`);
      assert.ok(Math.abs(ready.surfaceBottom - ready.pager.top) <= 1, `table/pagination seam detached at ${width}px`);
      assert.ok(Math.abs(ready.pager.bottom - (ready.frame.bottom - 1)) <= 1, `pagination escaped outer frame at ${width}px`);
      assert.ok(ready.paginationRight <= ready.pager.right, `pagination escaped padded footer at ${width}px`);
      assert.ok(ready.nextRight <= ready.paginationRight + 1, `pagination controls overflowed at ${width}px`);
      if (width >= 1440) {
        const frame = await page.locator(".demo-list-frame").boundingBox();
        assert.ok(Math.abs((ready.root.left - frame.x) - (frame.x + frame.width - ready.root.right)) <= 2, `page not centered at ${width}px`);
      }
      if (width > 640) {
        assert.ok(ready.headers[0] <= 400, `user column stretched at ${width}px`);
        assert.ok(ready.headers[3] <= 300, `team column stretched at ${width}px`);
        for (const [index, expected] of [[1, 142], [2, 132], [4, 160], [5, 80]]) {
          assert.ok(Math.abs(ready.headers[index] - expected) <= 1, `compact column ${index} drifted at ${width}px`);
        }
        if (width === 736) {
          assert.ok(ready.statusRight <= ready.actionLeft, "status chip is obscured by pinned actions at 736px");
        }
      } else {
        assert.equal(await root.locator(".pui-data-table__mobile").isVisible(), true);
        assert.equal(await root.locator(".pui-mobile-data-row").count(), 5);
        const firstMobileRow = root.locator(".pui-mobile-data-row").first();
        assert.match(await firstMobileRow.innerText(), /平台 · 管理员/);
        assert.match(await firstMobileRow.innerText(), /加入 2026-09-08/);
      }
      const focusTarget = root.locator(width <= 640
        ? ".pui-data-table__mobile .pui-mobile-data-row:first-child .pui-icon-button"
        : ".pui-data-table__scroller tbody tr:first-child td:last-child .pui-icon-button");
      await focusTarget.focus();
      const focusClearance = await focusTarget.evaluate((button) => {
        const frame = button.closest(".pui-data-table__frame").getBoundingClientRect();
        const box = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        return {
          active: document.activeElement === button,
          ring,
          clearances: [box.left - frame.left, frame.right - box.right, box.top - frame.top, frame.bottom - box.bottom],
        };
      });
      assert.equal(focusClearance.active, true, `first row action cannot receive keyboard focus at ${width}px`);
      assert.ok(focusClearance.ring > 0, `first row action lost focus outline at ${width}px`);
      assert.ok(focusClearance.clearances.every((clearance) => clearance >= focusClearance.ring), `first row action focus outline clipped by table at ${width}px: ${JSON.stringify(focusClearance)}`);
      if (process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX && [2560, 736, 320].includes(width)) {
        await page.screenshot({
          path: `${process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX}-${width === 320 ? "320-paged-full" : width}.png`,
          fullPage: width === 320,
        });
      }
      if (width === 736) {
        const scrollResult = await root.locator(".pui-data-table__scroller").evaluate((scroller) => {
          scroller.scrollLeft = scroller.scrollWidth;
          const dateCell = scroller.querySelector("tbody tr:first-child td:nth-child(5)");
          const pinnedAction = scroller.querySelector("tbody tr:first-child td:last-child");
          return {
            scrollLeft: scroller.scrollLeft,
            dateRight: dateCell.getBoundingClientRect().right,
            actionLeft: pinnedAction.getBoundingClientRect().left,
            actionRight: pinnedAction.getBoundingClientRect().right,
            scrollerRight: scroller.getBoundingClientRect().right,
          };
        });
        assert.ok(scrollResult.scrollLeft > 0, "narrow table cannot scroll horizontally");
        assert.ok(scrollResult.dateRight <= scrollResult.actionLeft + 1, "date column obscured after scrolling");
        assert.ok(scrollResult.actionRight <= scrollResult.scrollerRight + 1, "pinned actions escaped rounded table");
      }

      if ([1440, 320].includes(width)) {
        await page.getByRole("button", { name: "编辑陈沐" }).click();
        const drawer = page.getByRole("dialog", { name: "编辑陈沐的权限" });
        await drawer.waitFor();
        if (process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX && width === 320) {
          await page.screenshot({ path: `${process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX}-drawer-320.png` });
        }
        await drawer.getByRole("combobox", { name: "角色" }).click();
        await page.getByRole("option", { name: "查看者" }).click();
        await drawer.getByRole("combobox", { name: "状态" }).click();
        await page.getByRole("option", { name: "已停用" }).click();
        await drawer.getByRole("button", { name: "保存" }).click();
        await drawer.getByRole("button", { name: "保存中" }).waitFor();
        await drawer.waitFor({ state: "detached" });
        const firstRow = width === 320
          ? root.locator(".pui-mobile-data-row").first()
          : root.getByRole("row", { name: /陈沐/ });
        assert.match(await firstRow.innerText(), /查看者/);
        assert.match(await firstRow.innerText(), /已停用/);
      }

      await page.getByRole("button", { name: "刷新", exact: true }).click();
      await page.locator('.demo-list-frame .pui-data-table[data-state="loading"]').waitFor();
      const loading = await measure();
      assert.deepEqual(loading.frameRadii, ready.frameRadii, `loading table changed outer corners at ${width}px`);
      assert.deepEqual(loading.surfaceRadii, ready.surfaceRadii, `loading table changed surface corners at ${width}px`);
      assert.ok(Math.abs(loading.tableWidth - ready.tableWidth) <= 1, `table width shifted while loading at ${width}px`);
      assert.ok(Math.abs(loading.scrollerHeight - ready.scrollerHeight) <= 1, `table surface shifted while loading at ${width}px`);
      assert.ok(Math.abs(loading.pager.top - ready.pager.top) <= 1, `pagination jumped while loading at ${width}px`);
      if (width <= 640) assert.ok(loading.mobileHeight >= ready.mobileHeight - 1, `mobile rows shrank while loading at ${width}px`);
      await page.locator('.demo-list-frame .pui-data-table[data-state="ready"]').waitFor();

      await page.getByRole("button", { name: "下一页" }).click();
      await page.getByText("6-10 / 共 23 条").waitFor({ state: "attached" });
      const nextPage = await measure();
      assert.ok(Math.abs(nextPage.surfaceRight - nextPage.pager.right) <= 1, `pagination shifted after page change at ${width}px`);

      const view = page.getByRole("group", { name: "表格视图" });
      await view.getByRole("button", { name: "全部" }).click();
      const all = await measure();
      assert.equal(await view.getByRole("button", { name: "全部" }).getAttribute("aria-pressed"), "true");
      assert.equal(all.paginated, false, `unpaginated table retained mode marker at ${width}px`);
      assert.equal(all.pager, null, `unpaginated table retained a pager at ${width}px`);
      assert.deepEqual(all.frameRadii, ready.frameRadii, `unpaginated table changed outer corners at ${width}px`);
      assert.deepEqual(all.surfaceRadii, ["11px", "11px", "11px", "11px"], `unpaginated table surface corners differ at ${width}px`);
      assert.equal(await root.locator(width <= 640 ? ".pui-mobile-data-row" : "tbody tr").count(), 23, `unpaginated mode truncated rows at ${width}px`);
      assert.ok(Math.abs(all.surfaceBottom - (all.frame.bottom - 1)) <= 1, `unpaginated surface detached from bottom edge at ${width}px`);
      assert.ok(all.documentWidth <= all.viewportWidth, `unpaginated mode overflowed at ${width}px`);
      if (process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX && width === 320) {
        await page.locator(".pui-toast").first().waitFor({ state: "detached" });
        await page.screenshot({ path: `${process.env.PERSONAL_UI_LIST_SCREENSHOT_PREFIX}-320-all-full.png`, fullPage: true });
      }
      await page.getByRole("button", { name: "刷新", exact: true }).click();
      await page.locator('.demo-list-frame .pui-data-table[data-state="loading"]').waitFor();
      const allLoading = await measure();
      assert.equal(allLoading.pager, null, `unpaginated loading gained a pager at ${width}px`);
      assert.ok(Math.abs(allLoading.frame.bottom - all.frame.bottom) <= 1, `unpaginated loading changed table height at ${width}px`);
      await page.locator('.demo-list-frame .pui-data-table[data-state="ready"]').waitFor();
      await view.getByRole("button", { name: "分页" }).click();
      assert.equal(await root.locator(".pui-data-table__pagination").count(), 1, `paged mode did not restore pagination at ${width}px`);
      assert.equal(await root.locator(width <= 640 ? ".pui-mobile-data-row" : "tbody tr").count(), 5, `paged mode did not reset to five rows at ${width}px`);
    } finally {
      await page.close();
    }
  }
  console.log("List/table page width browser regression passed at 2560, 1440, 1024, 736, 360, and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
