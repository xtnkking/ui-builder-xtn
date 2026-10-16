// @ui-coverage {"kind":"browser","runner":"browser","exports":["Pagination","DataTable"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1100 } });

test("@locale-pagination locale examples give both languages equal responsive space without clipping page text", async ({ page }) => {
  await page.goto("/#/components/locale");
  for (const width of [2048, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    for (const state of ["总览", "使用方式", "多语言"]) {
      await page.getByRole("tab", { name: state, exact: true }).click();
      const preview = page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
      const chinese = preview.locator('[data-locale-example="zh-CN"]');
      const english = preview.locator('[data-locale-example="en-US"]');
      const zh = await bounds(chinese);
      const en = await bounds(english);
      expect(zh.width).toBeCloseTo(en.width, 1);
      if (width === 2048) {
        expect(zh.width).toBeGreaterThanOrEqual(280);
        expect(zh.y).toBeCloseTo(en.y, 1);
      } else {
        expect(zh.x).toBeCloseTo(en.x, 1);
        expect(en.y).toBeGreaterThan(zh.y + zh.height);
      }
      for (const column of [chinese, english]) {
        const nav = column.getByRole("navigation");
        const navBox = await bounds(nav);
        const text = nav.locator(".ui-pagination__mobile-page");
        await expect(text).toHaveText(column === chinese ? "2 / 8 页" : "Page 2 of 8");
        expect(await text.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
        const label = await bounds(nav.locator(".ui-pagination__mobile-label"));
        const previous = await bounds(nav.locator(".ui-pagination__controls > .ui-icon-button").first());
        const next = await bounds(nav.locator(".ui-pagination__controls > .ui-icon-button").last());
        expect(label.x).toBeGreaterThanOrEqual(previous.x + previous.width);
        expect(label.x + label.width).toBeLessThanOrEqual(next.x);
        expect(previous.x).toBeGreaterThanOrEqual(navBox.x);
        expect(next.x + next.width).toBeLessThanOrEqual(navBox.x + navBox.width + 1);
      }
      await preview.screenshot({ path: test.info().outputPath(`locale-pagination-${state}-${width}.png`), animations: "disabled" });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test("@pagination-label-spacing compact page text and loading glyph share the true center without width changes", async ({ page }) => {
  async function centered(label: Locator, loading = false) {
    await expect(label).toBeVisible();
    const geometry = await label.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const text = node.querySelector(".ui-pagination__mobile-page")!;
      const range = document.createRange();
      range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      const spinner = node.querySelector(".ui-pagination__mobile-loading svg")?.getBoundingClientRect();
      return { width: box.width, height: box.height, textOffset: ink.x + ink.width / 2 - box.x - box.width / 2,
        spinnerOffset: spinner ? spinner.x + spinner.width / 2 - box.x - box.width / 2 : null,
        textOpacity: getComputedStyle(text).opacity, overflow: text.scrollWidth - text.clientWidth };
    });
    expect(Math.abs(geometry.textOffset)).toBeLessThanOrEqual(0.5);
    expect(geometry.height).toBe(44);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    if (loading) {
      expect(geometry.textOpacity).toBe("0");
      expect(geometry.spinnerOffset).not.toBeNull();
      expect(Math.abs(geometry.spinnerOffset!)).toBeLessThanOrEqual(0.5);
    } else {
      expect(geometry.textOpacity).toBe("1");
    }
    return geometry;
  }

  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "项目统一表格高度预览", exact: true }).click();
  const tables = page.getByRole("tabpanel", { name: "项目统一表格高度预览", exact: true })
    .getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const labels = tables.locator(".ui-pagination__mobile-label");
  await expect(labels).toHaveCount(2);
  for (const label of await labels.all()) await centered(label);
  await tables.screenshot({ path: test.info().outputPath("table-page-label-centered.png"), animations: "disabled" });

  let idleWidth = 0;
  for (const state of ["默认", "加载中"]) {
    const preview = await previewFor(page, state);
    await preview.evaluate((node) => { node.style.width = "560px"; node.style.maxWidth = "100%"; });
    const label = preview.locator(".ui-pagination__mobile-label").first();
    const geometry = await centered(label, state === "加载中");
    if (state === "默认") idleWidth = geometry.width;
    else expect(geometry.width).toBeCloseTo(idleWidth, 1);
  }
  await page.setViewportSize({ width: 320, height: 1100 });
  const loadingPreview = page.getByRole("tabpanel", { name: "加载中", exact: true }).locator(".demo-explorer-preview");
  await centered(loadingPreview.locator(".ui-pagination__mobile-label").first(), true);
  const cursorPreview = await previewFor(page, "受控");
  for (const label of await cursorPreview.locator(".ui-pagination__cursor-label").all()) await centered(label);
  await cursorPreview.screenshot({ path: test.info().outputPath("cursor-page-label-320.png"), animations: "disabled" });
});

async function previewFor(page: Page, state: string) {
  await page.goto("/#/components/pagination");
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function freezeClock(page: Page) {
  const time = new Date("2026-10-15T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
}

test("numbered pagination keeps desktop jumps and intentional compact status while cursor mode has no invented total", async ({ page }) => {
  const preview = await previewFor(page, "默认");
  const numbered = preview.getByRole("navigation", { name: "数据分页", exact: true });
  await expect(numbered.getByRole("button", { name: "第 3 页", exact: true })).toBeVisible();
  await expect(numbered).toContainText("41-60 / 231 条结果");
  expect((await bounds(numbered.getByRole("combobox"))).height).toBe(36);
  for (const control of await numbered.locator("button:visible").all()) {
    expect((await bounds(control)).height).toBe(36);
  }
  // Resize only the caller-owned preview: numeric jumps intentionally collapse below 600px.
  await preview.evaluate((node) => { node.style.width = "560px"; node.style.maxWidth = "100%"; });
  await expect(numbered.locator(".ui-pagination__pages")).toBeHidden();
  await expect(numbered.locator(".ui-pagination__mobile-label")).toHaveText("3 / 12 页");
  for (const control of await numbered.locator("button:visible").all()) {
    expect((await bounds(control)).height).toBe(44);
  }
  expect((await bounds(numbered.getByRole("combobox"))).height).toBe(44);
  await preview.screenshot({ path: test.info().outputPath("numbered-compact.png"), animations: "disabled" });

  const cursorPreview = await previewFor(page, "受控");
  const section = cursorPreview.getByRole("region", { name: "未知总数分页", exact: true });
  const cursor = section.getByRole("navigation", { name: "数据分页", exact: true });
  await expect(cursor).toHaveAttribute("data-mode", "cursor");
  await expect(cursor.getByRole("button")).toHaveCount(2);
  await expect(cursor.locator('[aria-current="page"]')).toHaveText("第 1 页");
  await expect(cursor).not.toContainText("结果");
  await expect(cursor).not.toContainText("/");
  await expect(cursor.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await freezeClock(page);
  const next = cursor.getByRole("button", { name: "下一页", exact: true });
  const idle = await bounds(next);
  await next.press("Enter");
  await expect(next).toHaveAttribute("data-loading", "true");
  expect((await bounds(next)).width).toBe(idle.width);
  expect((await bounds(next)).height).toBe(idle.height);
  await next.press("Enter");
  await expect(section.getByRole("status")).toHaveText("已发起 1 次请求");
  await page.clock.runFor(650);
  await expect(cursor.locator('[aria-current="page"]')).toHaveText("第 2 页");
  await cursor.getByRole("button", { name: "上一页", exact: true }).press("Space");
  await page.clock.runFor(650);
  await expect(cursor.locator('[aria-current="page"]')).toHaveText("第 1 页");
  await cursorPreview.screenshot({ path: test.info().outputPath("cursor-desktop.png"), animations: "disabled" });

  await page.getByRole("tab", { name: "多语言", exact: true }).click();
  const english = page.getByRole("tabpanel", { name: "多语言", exact: true })
    .locator('[data-ui-owner="Pagination"][data-mode="cursor"]');
  await expect(english).toHaveAttribute("aria-label", "Data pagination");
  await expect(english.locator('[aria-current="page"]')).toHaveText("Page 1");
  await expect(english.getByRole("button", { name: "Next page", exact: true })).toBeVisible();
  await expect(english).not.toContainText("of");
});

test("cursor table footer keeps page and size request dimensions stable with 44px targets and containment at 320px", async ({ page }) => {
  const preview = await previewFor(page, "受控");
  const section = preview.getByRole("region", { name: "未知总数表格", exact: true });
  const table = section.locator('[data-ui-owner="DataTable"]');
  const frame = table.locator(".ui-data-table__frame");
  const nav = table.getByRole("navigation", { name: "数据分页", exact: true });
  await expect(frame.locator(".ui-data-table__pagination")).toContainText("第 1 页");
  await expect(nav.getByRole("button")).toHaveCount(2);
  const originalFrame = await bounds(frame);
  const originalFooter = await bounds(nav);
  const pageSize = nav.getByRole("combobox", { name: /^每页数量/ });
  const originalSize = await bounds(pageSize);
  await freezeClock(page);
  await pageSize.click();
  await page.getByRole("option", { name: "50 条", exact: true }).click();
  await expect(pageSize).toHaveAttribute("aria-busy", "true");
  await expect(pageSize).toContainText("20 条");
  expect((await bounds(pageSize)).width).toBeCloseTo(originalSize.width, 0);
  expect((await bounds(pageSize)).height).toBe(originalSize.height);
  expect((await bounds(frame)).height).toBeCloseTo(originalFrame.height, 0);
  await page.clock.runFor(650);
  await expect(pageSize).toContainText("50 条");
  await expect(section.getByRole("status")).toHaveText("已发起 1 次请求");
  expect((await bounds(frame)).height).toBeCloseTo(originalFrame.height, 0);
  expect((await bounds(nav)).height).toBeCloseTo(originalFooter.height, 0);

  await page.setViewportSize({ width: 320, height: 1100 });
  const mobileFrame = await bounds(frame);
  const mobileNav = await bounds(nav);
  for (const control of await nav.locator("button:visible").all()) {
    const box = await bounds(control);
    expect(box.height).toBe(44);
    if (await control.getAttribute("role") !== "combobox") expect(box.width).toBe(44);
    expect(box.x).toBeGreaterThanOrEqual(mobileNav.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(mobileNav.x + mobileNav.width + 1);
  }
  expect((await bounds(pageSize)).height).toBe(44);
  const next = nav.getByRole("button", { name: "下一页", exact: true });
  await next.focus();
  await next.press("Enter");
  await expect(next).toHaveAttribute("data-loading", "true");
  expect((await bounds(frame)).height).toBeCloseTo(mobileFrame.height, 0);
  await page.clock.runFor(650);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("第 2 页");
  expect((await bounds(frame)).height).toBeCloseTo(mobileFrame.height, 0);
  await next.press("Enter");
  await page.clock.runFor(650);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("第 3 页");
  await expect(next).toBeDisabled();
  expect((await bounds(frame)).height).toBeCloseTo(mobileFrame.height, 0);
  for (const label of [pageSize.locator(".ui-select__value > span:last-child"), nav.locator(".ui-pagination__mobile-page")]) {
    await expect(label).toBeVisible();
    expect(await label.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await section.screenshot({ path: test.info().outputPath("cursor-table-320.png"), animations: "disabled" });
});

test("numbered and cursor table pagination share project styling across desktop narrow and dark contexts", async ({ page }) => {
  await page.goto("/#/components/pagination");
  await page.getByRole("tab", { name: "统一分页风格预览", exact: true }).click();
  const casePanel = page.getByRole("tabpanel", { name: "统一分页风格预览", exact: true });

  for (const dark of [false, true]) {
    await casePanel.getByRole("tab", { name: dark ? "深色模式" : "默认", exact: true }).click();
    const statePanel = casePanel.getByRole("tabpanel", { name: dark ? "深色模式" : "默认", exact: true });
    const pair = statePanel.getByRole("region", { name: "分页样式对照", exact: true });
    const numbered = pair.getByRole("region", { name: "已知总数列表", exact: true }).getByRole("navigation", { name: "数据分页", exact: true });
    const cursor = pair.getByRole("region", { name: "未知总数列表", exact: true }).getByRole("navigation", { name: "数据分页", exact: true });

    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      const numberedCurrent = numbered.locator('.ui-pagination__pages [aria-current="page"]:visible, .ui-pagination__mobile-label:visible');
      const cursorCurrent = cursor.locator('[aria-current="page"]');
      await expect(numberedCurrent).toHaveCount(1);
      await expect(cursorCurrent).toHaveText("第 1 页");
      expect(await cursorCurrent.evaluate((node) => ({ tag: node.tagName, tabIndex: (node as HTMLElement).tabIndex })))
        .toEqual({ tag: "SPAN", tabIndex: -1 });
      await expect(cursor.getByRole("button")).toHaveCount(2);
      await expect(cursor).not.toContainText("结果");
      await expect(cursor).not.toContainText("/");

      const appearance = async (node: Locator) => node.evaluate((element) => {
        const style = getComputedStyle(element);
        return { height: style.height, fontFamily: style.fontFamily, fontSize: style.fontSize,
          fontWeight: style.fontWeight, lineHeight: style.lineHeight, radius: style.borderRadius,
          background: style.backgroundColor, color: style.color, borderColor: style.borderTopColor,
          borderWidth: style.borderTopWidth };
      });
      expect(await appearance(cursorCurrent)).toEqual(await appearance(numberedCurrent));
      const targetHeight = width === 320 ? 44 : 36;
      for (const nav of [numbered, cursor]) {
        const navBox = await bounds(nav);
        const current = nav === numbered ? numberedCurrent : cursorCurrent;
        const currentBox = await bounds(current);
        expect(currentBox.height).toBe(targetHeight);
        expect(currentBox.width).toBeGreaterThanOrEqual(targetHeight);
        const previous = nav.getByRole("button", { name: "上一页", exact: true });
        const next = nav.getByRole("button", { name: "下一页", exact: true });
        for (const control of [previous, current, next, nav.getByRole("combobox")]) {
          const box = await bounds(control);
          expect(box.height).toBe(targetHeight);
          expect(box.x).toBeGreaterThanOrEqual(navBox.x - 1);
          expect(box.x + box.width).toBeLessThanOrEqual(navBox.x + navBox.width + 1);
        }
        const previousBox = await bounds(previous);
        const nextBox = await bounds(next);
        expect(currentBox.y + currentBox.height / 2).toBeCloseTo(previousBox.y + previousBox.height / 2, 0);
        expect(currentBox.y + currentBox.height / 2).toBeCloseTo(nextBox.y + nextBox.height / 2, 0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await pair.screenshot({ path: test.info().outputPath(`pagination-consistency-${dark ? "dark" : "light"}-${width}.png`), animations: "disabled" });
    }
  }

  await casePanel.getByRole("tab", { name: "长内容", exact: true }).click();
  const longCursor = casePanel.getByRole("tabpanel", { name: "长内容", exact: true })
    .getByRole("region", { name: "未知总数列表", exact: true }).getByRole("navigation", { name: "数据分页", exact: true });
  const longCurrent = longCursor.locator('[aria-current="page"]');
  await expect(longCurrent).toHaveAttribute("title", /123[\s,\d]*345/);
  const longBox = await bounds(longCurrent);
  const longNavBox = await bounds(longCursor);
  expect(longBox.x).toBeGreaterThanOrEqual(longNavBox.x - 1);
  expect(longBox.x + longBox.width).toBeLessThanOrEqual(longNavBox.x + longNavBox.width + 1);
  await expect(longCursor.getByRole("button", { name: "下一页", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
