// @ui-coverage {"kind":"browser","runner":"browser","exports":["Button","FilterBar","ListManagementPage","SearchFilterPage","MemberManagementPage","DataTable","TreeTable","TreeSelect"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function openExample(page: Page) {
  await page.goto("/#/patterns/list-filter");
  // Widen only the documentation host so the 1160px page policy is observable.
  await page.locator(".demo-explorer-main").evaluate(node => { node.style.width = "100%"; });
  await page.getByRole("tab", { name: "同站列表一致性预览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "同站列表一致性预览", exact: true }).locator(".demo-explorer-preview");
}

async function choose(page: Page, root: Locator, label: string, option: string) {
  // Select announces its current value after the caller's accessible label.
  await root.getByRole("combobox", { name: new RegExp(`^${label}(?:，|$)`) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const result = await node.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

async function route(root: Locator, label: string) {
  await root.getByRole("tab", { name: label, exact: true }).click();
  return root.getByRole("tabpanel", { name: label, exact: true });
}

test("same-site list queries and content edges match across three pages, including empty and mobile", async ({ page }) => {
  for (const width of [1920, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const root = await openExample(page);
    let baseline: Awaited<ReturnType<typeof appearance>> | undefined;
    let pageBounds: Awaited<ReturnType<typeof bounds>> | undefined;
    for (const label of ["服务器", "任务中心", "成员管理"]) {
      const panel = await route(root, label);
      const main = panel.locator('[data-ui-owner="ListManagementPage"], [data-ui-owner="SearchFilterPage"]');
      const table = panel.locator('[data-ui-owner="DataTable"]');
      const query = panel.getByRole("button", { name: "查询", exact: true });
      await expect(query).not.toHaveAttribute("aria-disabled", "true");
      await expect(query.locator(".ui-button__icon > svg")).toHaveCount(1);
      const current = await appearance(query);
      baseline ??= current;
      expect(current).toEqual(baseline);
      expect(current.height).toBe(width === 320 ? 44 : 38);
      const box = await bounds(main);
      pageBounds ??= box;
      expect(Math.abs(box.x - pageBounds.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - pageBounds.width)).toBeLessThanOrEqual(1);
      const frame = await bounds(table.locator(".ui-data-table__frame"));
      expect(Math.abs(frame.x - box.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.width - box.width)).toBeLessThanOrEqual(1);

      await panel.getByRole("searchbox").fill("无匹配结果");
      await panel.getByRole("searchbox").press("Enter");
      await expect(table).toHaveAttribute("data-state", "empty");
      const empty = await bounds(table.locator(".ui-data-table__frame"));
      expect(Math.abs(empty.width - frame.width)).toBeLessThanOrEqual(1);
      expect((await bounds(query)).width).toBeCloseTo(current.width, 0);
      await panel.screenshot({ path: test.info().outputPath(`${label}-${width}.png`) });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

async function appearance(button: Locator) {
  return button.evaluate((element) => {
    const css = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { width: Math.round(box.width), height: box.height, background: css.backgroundColor,
      color: css.color, radius: css.borderRadius, padding: css.paddingInline, font: css.fontSize };
  });
}

test("one shared width setting applies to every list page", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const root = await openExample(page);
  for (const option of ["全项目限宽", "全项目铺满"]) {
    await choose(page, root, "项目列表宽度", option);
    let reference: Awaited<ReturnType<typeof bounds>> | undefined;
    for (const label of ["服务器", "任务中心", "成员管理"]) {
      const panel = await route(root, label);
      const box = await bounds(panel.locator('[data-ui-owner="ListManagementPage"], [data-ui-owner="SearchFilterPage"]'));
      reference ??= box;
      expect(Math.abs(box.x - reference.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - reference.width)).toBeLessThanOrEqual(1);
      if (option === "全项目限宽") expect(box.width).toBe(1160);
      else expect(box.width).toBeGreaterThan(1160);
    }
  }
});

test("fixed and flexible columns preserve the same full-width outer table", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  const root = await openExample(page);
  const panel = await route(root, "服务器");
  const frame = panel.locator(".ui-data-table__frame");
  const table = panel.getByRole("table", { name: "服务器数据", exact: true });
  const before = await bounds(frame);
  const viewportWidth = await panel.locator(".ui-data-table__scroller").evaluate(node => node.clientWidth);
  expect(Math.abs((await bounds(table)).width - viewportWidth)).toBeLessThanOrEqual(1);
  await choose(page, root, "表格列宽", "各列固定宽度");
  expect((await bounds(table)).width).toBe(360);
  expect((await bounds(frame)).width).toBe(before.width);
});

test("table frames and tree selection corners follow each shared theme", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const root = await openExample(page);
  for (const [label, tableRadius, rowRadius] of [["默认", "12px", "6px"], ["Apple", "16px", "14px"], ["Material", "16px", "10px"]]) {
    await choose(page, root, "项目主题", label);
    const frame = root.getByRole("tabpanel", { name: "服务器", exact: true }).locator(".ui-data-table__frame");
    const tree = root.locator('[data-ui-owner="TreeTable"]');
    await expect(frame).toHaveCSS("border-top-left-radius", tableRadius);
    await expect(tree).toHaveCSS("border-top-left-radius", tableRadius);
    expect(await tree.evaluate(element => getComputedStyle(element).borderColor)).toBe(await frame.evaluate(element => getComputedStyle(element).borderColor));
    await root.getByRole("combobox", { name: "资源所属团队", exact: true }).click();
    const selected = page.getByRole("treeitem", { name: "平台工程", exact: true });
    await expect(selected).toBeFocused();
    await expect(selected.locator(".ui-tree-select__row")).toHaveCSS("border-top-left-radius", rowRadius);
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await selected.screenshot({ path: test.info().outputPath(`tree-${label}.png`) });
    await selected.press("Escape");
    await expect(root.getByRole("combobox", { name: "资源所属团队", exact: true })).toBeFocused();
  }
});

test("tree selection popup follows its field width on desktop and mobile", async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const root = await openExample(page);
    const trigger = root.getByRole("combobox", { name: "资源所属团队", exact: true });
    const host = trigger.locator("..").locator("..");
    for (const fieldWidth of [240, 160]) {
      // Resize the non-interactive outer Box, never the protected control.
      await host.evaluate((node, size) => { node.style.width = `${size}px`; }, fieldWidth);
      const field = await bounds(trigger);
      expect(field.width).toBeLessThanOrEqual(fieldWidth);
      await trigger.click();
      const popup = page.getByRole("tree", { name: "资源所属团队", exact: true });
      await expect.poll(async () => Math.abs((await bounds(popup)).width - field.width)).toBeLessThanOrEqual(1);
      const menu = await bounds(popup);
      expect(menu.x).toBeGreaterThanOrEqual(11);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width - 11);
      await popup.screenshot({ path: test.info().outputPath(`tree-width-${width}-${fieldWidth}.png`), animations: "disabled" });
      const selected = page.getByRole("treeitem", { name: "平台工程", exact: true });
      await expect(selected).toBeFocused();
      await selected.press("Escape");
      await expect(trigger).toBeFocused();
    }
  }
});

test("tree selection popup truncates long labels within mobile bounds", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.goto("/#/components/tree-select");
  await page.getByRole("tab", { name: "长内容", exact: true }).click();
  const preview = page.locator('[data-state-example="longContent"]');
  const trigger = preview.getByRole("combobox", { name: "长组织名称", exact: true });
  const field = await bounds(trigger);
  await trigger.click();
  const popup = page.getByRole("tree", { name: "长组织名称", exact: true });
  await expect.poll(async () => Math.abs((await bounds(popup)).width - field.width)).toBeLessThanOrEqual(1);
  const parent = popup.getByRole("treeitem", { name: "International subscription platform operations and enterprise security engineering organization", exact: true });
  await expect(parent).toBeFocused();
  await parent.press("ArrowRight");
  const child = popup.getByRole("treeitem", { name: "Cross-region settlement engineering and global enterprise account support operations team", exact: true });
  const text = child.locator(".ui-tree-select__label > span:last-of-type");
  await expect(text).toHaveCSS("text-overflow", "ellipsis");
  await expect(text).toHaveCSS("white-space", "nowrap");
  expect(await text.evaluate(node => node.scrollWidth > node.clientWidth && node.clientWidth > 0)).toBe(true);
  const menu = await bounds(popup);
  expect(menu.x).toBeGreaterThanOrEqual(11);
  expect(menu.x + menu.width).toBeLessThanOrEqual(309);
  await popup.screenshot({ path: test.info().outputPath("tree-long-320.png"), animations: "disabled" });
  await parent.press("ArrowDown");
  await expect(child).toBeFocused();
  await child.press("Escape");
  await expect(trigger).toBeFocused();
});
