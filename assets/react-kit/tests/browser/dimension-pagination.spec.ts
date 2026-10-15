// @ui-coverage {"kind":"browser","runner":"browser","exports":["Pagination","DataTable"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1100 } });

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
