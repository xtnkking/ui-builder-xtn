// @ui-coverage {"kind":"browser","runner":"browser","exports":["DataTable"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function dimensionsCase(page: Page, width = 1440, height = 1000) {
  await page.setViewportSize({ width, height });
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "表格高度与滚动预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "表格高度与滚动预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const table = preview.locator('[data-ui-owner="DataTable"]');
  await expect(table).toHaveCount(1);
  return { preview, table, frame: table.locator(".ui-data-table__frame") };
}

async function choose(page: Page, preview: Locator, control: "表格结果状态" | "表格高度方式", label: string) {
  await preview.getByRole("combobox", { name: new RegExp(`^${control}`) }).click();
  const options = page.getByRole("listbox", { name: control, exact: true });
  await options.getByRole("option", { name: label, exact: true }).click();
  await expect(options).toBeHidden();
}

async function height(element: Locator) {
  return element.evaluate((node) => node.getBoundingClientRect().height);
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("default paginated and unpaginated tables retain height through sparse, loading, empty, error and wrapped rows", async ({ page }) => {
  const { preview, table, frame } = await dimensionsCase(page);
  for (const paginated of [true, false]) {
    await preview.getByRole("checkbox", { name: "显示分页", exact: true }).setChecked(paginated);
    await choose(page, preview, "表格结果状态", "1 条记录");
    const initialHeight = await height(frame);
    expect(await height(table.locator(".ui-data-table__scroller"))).toBeCloseTo(332, 0);
    for (const [label, state] of [["20 条记录", "ready"], ["加载状态", "loading"], ["空状态", "empty"], ["首次错误", "error"], ["保留数据错误", "error"], ["长内容", "ready"]]) {
      await choose(page, preview, "表格结果状态", label);
      await expect(table).toHaveAttribute("data-state", state);
      expect(Math.abs(await height(frame) - initialHeight)).toBeLessThanOrEqual(1);
      await expect(table.locator(".ui-data-table__pagination")).toHaveCount(paginated ? 1 : 0);
      if (label === "空状态") await expect(table.getByRole("button", { name: "恢复记录", exact: true })).toBeVisible();
      if (state === "error") await expect(table.getByRole("button", { name: "重试", exact: true })).toHaveCount(1);
      const notices = page.locator(".ui-toast");
      if (await notices.count()) await notices.getByRole("button", { name: /关闭通知/ }).click();
    }
    const scroller = table.locator(".ui-data-table__scroller");
    const row = table.locator("tbody tr").first();
    expect(await height(row)).toBeGreaterThan(58);
    const wrapped = row.locator(".ui-table-cell-text__primary").last();
    expect(await wrapped.evaluate((node) => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
    expect(await scroller.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await scroller.evaluate((node) => { node.scrollTop = 240; });
    expect(await scroller.evaluate((node) => Math.abs(node.querySelector("th")!.getBoundingClientRect().top - node.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
    await noPageOverflow(page);
  }
  await preview.screenshot({ path: test.info().outputPath("stable-table-height.png"), animations: "disabled" });
});

test("short 320px screens bound default table and mobile-card height while keeping scrolling and the pager inside the frame", async ({ page }) => {
  const { preview, table, frame } = await dimensionsCase(page, 320, 440);
  await choose(page, preview, "表格结果状态", "20 条记录");
  const scroller = table.locator(".ui-data-table__scroller");
  await expect(scroller).toHaveAttribute("tabindex", "0");
  expect(await height(scroller)).toBeCloseTo(220, 0);
  expect(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth && node.scrollHeight > node.clientHeight)).toBe(true);
  await scroller.focus();
  await scroller.press("ArrowDown");
  await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  const pager = table.locator(".ui-data-table__pagination");
  expect(await pager.evaluate((node) => node.getBoundingClientRect().bottom <= node.parentElement!.getBoundingClientRect().bottom)).toBe(true);
  await noPageOverflow(page);
  await preview.getByRole("checkbox", { name: "移动卡片", exact: true }).check();
  const mobile = table.getByRole("list", { name: "表格高度对照移动版", exact: true });
  expect(await height(mobile)).toBeCloseTo(220, 0);
  const stableHeight = await height(frame);
  await choose(page, preview, "表格结果状态", "空状态");
  expect(Math.abs(await height(frame) - stableHeight)).toBeLessThanOrEqual(1);
  const empty = table.locator(".ui-data-table__empty-scroller");
  expect(await height(empty)).toBeCloseTo(220, 0);
  await expect(table.getByRole("button", { name: "恢复记录", exact: true })).toBeVisible();
  await table.getByRole("button", { name: "恢复记录", exact: true }).click();
  expect(Math.abs(await height(frame) - stableHeight)).toBeLessThanOrEqual(1);
  await noPageOverflow(page);
  await preview.screenshot({ path: test.info().outputPath("short-table-mobile-320.png"), animations: "disabled" });
});

test("explicit numeric table capacity shares the short-screen limit and auto height follows result content", async ({ page }) => {
  const { preview, table } = await dimensionsCase(page, 320, 400);
  const scroller = table.locator(".ui-data-table__scroller");
  expect(await height(scroller)).toBeCloseTo(180, 0);
  await choose(page, preview, "表格高度方式", "固定 3 行单位");
  expect(await height(scroller)).toBeCloseTo(180, 0);
  await choose(page, preview, "表格结果状态", "20 条记录");
  expect(await height(scroller)).toBeCloseTo(180, 0);
  await choose(page, preview, "表格高度方式", "随内容高度");
  const contentHeight = await height(scroller);
  expect(contentHeight).toBeGreaterThan(1000);
  await choose(page, preview, "表格结果状态", "1 条记录");
  expect(await height(scroller)).toBeLessThan(contentHeight);
  expect(await height(scroller)).toBeLessThan(216);
  await noPageOverflow(page);
});
