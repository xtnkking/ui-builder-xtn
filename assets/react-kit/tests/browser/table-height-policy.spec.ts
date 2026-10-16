// @ui-coverage {"kind":"browser","runner":"browser","exports":["DataTable","DataTableProvider"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function projectHeightCase(page: Page, width = 1280, height = 720) {
  await page.setViewportSize({ width, height });
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "项目统一表格高度预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "项目统一表格高度预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const proxy = preview.getByRole("region", { name: "代理池高度示例", exact: true }).locator('[data-ui-owner="DataTable"]');
  const phones = preview.getByRole("region", { name: "混合号码池高度示例", exact: true }).locator('[data-ui-owner="DataTable"]');
  await expect(preview.locator('[data-ui-owner="DataTable"]')).toHaveCount(2);
  return { preview, proxy, phones };
}

async function size(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { height: rect.height, width: rect.width };
  });
}

function viewport(table: Locator) {
  return table.locator(".ui-data-table__scroller, .ui-data-table__empty-scroller");
}

async function choose(page: Page, control: Locator, name: string, option: string) {
  await control.getByRole("combobox", { name: new RegExp(`^${name}`) }).click();
  const options = page.getByRole("listbox", { name, exact: true });
  await options.getByRole("option", { name: option, exact: true }).click();
  await expect(options).toBeHidden();
}

async function sameTableGeometry(proxy: Locator, phones: Locator, expectedViewportHeight: number) {
  const proxyViewport = await size(viewport(proxy));
  const phonesViewport = await size(viewport(phones));
  expect(proxyViewport.height).toBeCloseTo(expectedViewportHeight, 0);
  expect(phonesViewport.height).toBeCloseTo(proxyViewport.height, 0);
  expect((await size(phones.locator(".ui-data-table__frame"))).height)
    .toBeCloseTo((await size(proxy.locator(".ui-data-table__frame"))).height, 0);
  for (const table of [proxy, phones]) {
    const pager = table.locator(".ui-data-table__pagination");
    await expect(pager).toHaveCount(1);
    const bounds = await pager.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const frame = node.parentElement!.getBoundingClientRect();
      return { gap: frame.bottom - rect.bottom, overflow: rect.right - frame.right };
    });
    expect(bounds.gap).toBeCloseTo(1, 0);
    expect(bounds.overflow).toBeLessThanOrEqual(1);
  }
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("@project-height project policy keeps sparse and populated tables equal through request states, page sizes and pagination", async ({ page }) => {
  const { preview, proxy, phones } = await projectHeightCase(page);
  await expect(proxy.locator("tbody tr")).toHaveCount(1);
  await expect(phones.locator("tbody tr")).toHaveCount(20);
  // The second example deliberately requests eight rows: the shared five-row policy wins.
  await sameTableGeometry(proxy, phones, 332);
  const initialFrame = await size(phones.locator(".ui-data-table__frame"));
  const initialPager = await size(phones.locator(".ui-data-table__pagination"));
  for (const [label, state] of [["加载状态", "loading"], ["空状态", "empty"], ["错误状态", "error"], ["显示记录", "ready"]]) {
    await choose(page, preview, "混合号码池状态", label);
    await expect(phones).toHaveAttribute("data-state", state);
    await sameTableGeometry(proxy, phones, 332);
    expect((await size(phones.locator(".ui-data-table__frame"))).height).toBeCloseTo(initialFrame.height, 0);
    expect((await size(phones.locator(".ui-data-table__pagination"))).height).toBeCloseTo(initialPager.height, 0);
  }
  for (const count of [5, 50]) {
    await choose(page, phones, "每页数量", `${count} 条`);
    await expect(phones.locator("tbody tr")).toHaveCount(count);
    await sameTableGeometry(proxy, phones, 332);
  }
  await phones.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(phones.getByText("phone-051", { exact: true })).toBeVisible();
  await sameTableGeometry(proxy, phones, 332);
  await noPageOverflow(page);
  await preview.screenshot({ path: test.info().outputPath("project-table-height-desktop.png"), animations: "disabled" });
});

test("@project-height project policy applies the same short-screen cap and contains scrolling at desktop and 320px", async ({ page }) => {
  for (const [width, height] of [[1280, 420], [320, 440]]) {
    const { preview, proxy, phones } = await projectHeightCase(page, width, height);
    const expectedHeight = Math.min(332, Math.max(158, height - 220));
    await sameTableGeometry(proxy, phones, expectedHeight);
    const scroller = viewport(phones);
    expect(await scroller.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await scroller.focus();
    await scroller.press("ArrowDown");
    await expect.poll(() => scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    if (width === 320) {
      expect(await scroller.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
      await scroller.evaluate((node) => { node.scrollLeft = 100; });
      expect(await scroller.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    }
    await choose(page, preview, "混合号码池状态", "空状态");
    await expect(phones).toHaveAttribute("data-state", "empty");
    await sameTableGeometry(proxy, phones, expectedHeight);
    await choose(page, preview, "混合号码池状态", "显示记录");
    await expect(phones.locator("tbody tr")).toHaveCount(20);
    await sameTableGeometry(proxy, phones, expectedHeight);
    await noPageOverflow(page);
    await preview.screenshot({ path: test.info().outputPath(`project-table-height-${width}-${height}.png`), animations: "disabled" });
  }
});
