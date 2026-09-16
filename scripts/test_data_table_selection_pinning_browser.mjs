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

  for (const width of [736, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.goto(new URL("data-table-selection-pinning-test.html", url).href);
      const rootFor = (label) => page.locator(`.pui-data-table:has(table[aria-label="${label}"])`);
      const table = rootFor("默认勾选列");
      await table.waitFor();
      const scroller = table.locator(".pui-data-table__scroller");
      const mobile = table.locator(".pui-data-table__mobile");

      if (width > 640) {
        const roundedOverflow = await table.evaluate((element) => {
          const frame = element.querySelector(".pui-data-table__frame");
          const scroller = element.querySelector(".pui-data-table__scroller");
          const frameStyle = getComputedStyle(frame);
          const scrollerStyle = getComputedStyle(scroller);
          return {
            frameOverflow: [frameStyle.overflowX, frameStyle.overflowY],
            frameBottomRadii: [frameStyle.borderBottomLeftRadius, frameStyle.borderBottomRightRadius],
            scrollerBottomRadii: [scrollerStyle.borderBottomLeftRadius, scrollerStyle.borderBottomRightRadius],
            clientWidth: scroller.clientWidth,
            scrollWidth: scroller.scrollWidth,
            clientHeight: scroller.clientHeight,
            scrollHeight: scroller.scrollHeight,
          };
        });
        assert.deepEqual(roundedOverflow.frameOverflow, ["hidden", "hidden"], "unpaginated table frame does not clip the horizontal scrollbar to its rounded corners");
        assert.deepEqual(roundedOverflow.frameBottomRadii, ["12px", "12px"], "unpaginated table bottom frame corners differ");
        assert.deepEqual(roundedOverflow.scrollerBottomRadii, ["11px", "11px"], "unpaginated table bottom scroller corners differ");
        assert.equal(await table.locator(".pui-data-table__pagination").count(), 0, "unpaginated horizontal-overflow fixture unexpectedly rendered pagination");
        assert.ok(roundedOverflow.scrollWidth > roundedOverflow.clientWidth, "selection table does not have horizontal overflow for the bottom-corner check");
        assert.ok(roundedOverflow.scrollHeight <= roundedOverflow.clientHeight + 1, "horizontal-overflow fixture accidentally gained vertical scrolling");

        const headers = scroller.locator(":scope > table > thead > tr > th");
        const cells = scroller.locator(":scope > table > tbody > tr:first-child > td");
        assert.equal(await headers.count(), 5, "selection table column count changed");
        for (const index of [0, 1]) {
          assert.ok((await headers.nth(index).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), `header ${index + 1} is not pinned to start`);
          assert.ok((await cells.nth(index).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), `cell ${index + 1} is not pinned to start`);
        }
        assert.ok(!(await headers.nth(2).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "third column was pinned by the selection default");

        const before = await cells.evaluateAll((elements) => elements.slice(0, 3).map((element) => element.getBoundingClientRect().left));
        const scroll = await scroller.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
        assert.ok(scroll.scrollWidth > scroll.clientWidth, "selection table does not have horizontal overflow for the sticky-column check");
        const appliedScrollLeft = await scroller.evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
          return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(element.scrollLeft))));
        });
        const after = await cells.evaluateAll((elements) => elements.slice(0, 3).map((element) => element.getBoundingClientRect().left));
        assert.ok(Math.abs(after[0] - before[0]) <= 1, "selection column moved during horizontal scrolling");
        assert.ok(Math.abs(after[1] - before[1]) <= 1, "second column moved during horizontal scrolling");
        assert.ok(appliedScrollLeft > 0, "horizontal scroll did not move");
        assert.ok(Math.abs((before[2] - after[2]) - appliedScrollLeft) <= 1, "third column did not follow the horizontal scroll offset");
        assert.ok((await headers.last().getAttribute("class"))?.includes("pui-data-table__cell--pin-end"), "existing end-pinned action column lost its sticky class");

        const disabledPairHeaders = rootFor("首列取消固定").locator(".pui-data-table__scroller > table > thead > tr > th");
        assert.ok(!(await disabledPairHeaders.nth(0).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "pin:false did not disable the selection pair default");
        assert.ok(!(await disabledPairHeaders.nth(1).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "pin:false left the second column automatically pinned");

        const endOverrideTable = rootFor("第二列右侧固定");
        const endOverrideSelection = endOverrideTable.getByRole("checkbox", { name: "第二列右侧固定选择全部" }).locator("xpath=ancestor::th");
        const endOverrideName = endOverrideTable.getByRole("columnheader", { name: "姓名" });
        assert.ok((await endOverrideSelection.getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "second-column override removed the selection-column default");
        assert.ok((await endOverrideName.getAttribute("class"))?.includes("pui-data-table__cell--pin-end"), "explicit second-column end pin was not honored");
        assert.ok(!(await endOverrideName.getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "explicit second-column end pin retained the automatic start pin");

        const hiddenPrefixHeaders = rootFor("隐藏前导列").locator(".pui-data-table__scroller > table > thead > tr > th");
        assert.ok((await hiddenPrefixHeaders.nth(0).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "selection column did not become the leading visible pinned column");
        assert.ok((await hiddenPrefixHeaders.nth(1).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "second visible column was not pinned after a hidden prefix");

        const hiddenSelectionHeaders = rootFor("隐藏勾选列").locator(".pui-data-table__scroller > table > thead > tr > th");
        assert.ok(!(await hiddenSelectionHeaders.nth(0).getAttribute("class"))?.includes("pui-data-table__cell--pin-start"), "hidden selection column triggered automatic pinning");
      } else {
        assert.equal(await scroller.evaluate((element) => getComputedStyle(element).display), "none", "desktop table remains visible on mobile");
        assert.equal(await mobile.evaluate((element) => getComputedStyle(element).display), "block", "mobile rows are hidden");
        assert.equal(await mobile.locator(".pui-mobile-data-row").count(), 1, "mobile selection fixture row count changed");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile selection example causes horizontal overflow");
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `selection example escaped the page at ${width}px`);
    } finally {
      await page.close();
    }
  }

  console.log("DataTable leading selection-column pinning passed at 736px and 320px.");
} finally {
  await browser?.close();
  await server.close();
}
