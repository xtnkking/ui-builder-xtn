// @ui-coverage {"kind":"browser","runner":"browser","exports":["DropdownMenu","IconButton","Tooltip","DataTable","ConfirmDialog","SplitButton"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function mixedActions(page: Page) {
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "操作列组合预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "操作列组合预览", exact: true });
  await panel.getByRole("tab", { name: "长内容", exact: true }).click();
  const preview = panel.locator('[data-state-example="longContent"] .demo-explorer-preview');
  const table = preview.getByRole("table", { name: "代理操作示例", exact: true });
  await expect(table).toBeVisible();
  return { preview, table };
}

async function bounds(target: Locator) {
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectMatchedIcons(table: Locator, name: string) {
  const group = table.getByRole("group", { name: `${name}的操作`, exact: true });
  const buttons = group.getByRole("button");
  await expect(buttons).toHaveCount(3);
  const geometry = await buttons.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    const css = getComputedStyle(element);
    return { width: rect.width, height: rect.height, y: rect.y, color: css.color, background: css.backgroundColor };
  }));
  for (const value of geometry) {
    expect(value.width).toBeCloseTo(36, 0);
    expect(value.height).toBeCloseTo(36, 0);
    expect(value.y).toBeCloseTo(geometry[0].y, 0);
  }
  const more = group.getByRole("button", { name: `更多操作：${name}`, exact: true });
  await expect(more).toHaveClass(/ui-icon-button--ghost/);
  expect(await more.textContent()).toBe("");
  await expect(more.locator("svg.lucide-ellipsis")).toHaveCount(1);
  await expect(more.locator("svg.lucide-chevron-down")).toHaveCount(0);
  expect(geometry[2].background).toBe(geometry[0].background);
  expect(geometry[2].color).toBe(geometry[0].color);
  return more;
}

async function expectMenuInViewport(menu: Locator, width: number) {
  const box = await bounds(menu);
  expect(box.x).toBeGreaterThanOrEqual(11);
  expect(box.x + box.width).toBeLessThanOrEqual(width - 11);
}

test("table icon overflow matches common actions and preserves keyboard, permissions and confirmed deletion", async ({ page }) => {
  const { preview, table } = await mixedActions(page);
  const more = await expectMatchedIcons(table, "代理 A");
  await more.focus();
  await expect(page.getByRole("tooltip", { name: "更多操作", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "更多操作：代理 A", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveText(["复制地址", "查看记录", "删除"]);
  await expect(menu.getByRole("menuitem", { name: "复制地址", exact: true })).toBeFocused();
  await expectMenuInViewport(menu, 1440);
  await expect(page.getByRole("tooltip", { name: "更多操作", exact: true })).toHaveCount(0);
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "删除", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.getByRole("menuitem", { name: "复制地址", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(menu).toHaveCount(0);

  const readOnly = table.getByRole("button", { name: "更多操作：只读代理", exact: true });
  await expect(table.getByRole("button", { name: "编辑只读代理", exact: true })).toBeDisabled();
  await readOnly.focus();
  await page.keyboard.press("ArrowUp");
  const readOnlyMenu = page.getByRole("menu", { name: "更多操作：只读代理", exact: true });
  await expect(readOnlyMenu.getByRole("menuitem", { name: "删除", exact: true })).toBeDisabled();
  await expect(readOnlyMenu.getByRole("menuitem", { name: "查看记录", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(readOnlyMenu.getByRole("menuitem", { name: "复制地址", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(readOnly).toBeFocused();
  await expect(readOnlyMenu).toHaveCount(0);

  await more.click();
  await menu.getByRole("menuitem", { name: "删除", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "删除代理", exact: true });
  await expect(confirm).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await confirm.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await more.click();
  await menu.getByRole("menuitem", { name: "删除", exact: true }).click();
  const remove = confirm.locator(".ui-confirm-actions").getByRole("button").nth(1);
  await expect(remove).toHaveAccessibleName("删除代理");
  await remove.click();
  await expect(remove).toHaveAttribute("aria-busy", "true");
  await expect(confirm).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator(".ui-toast").filter({ hasText: "已删除代理" })).toHaveCount(1);
  await preview.screenshot({ path: test.info().outputPath("mixed-actions-desktop.png"), animations: "disabled" });
});

test("320px icon overflow stays aligned and keeps both table scrolling and menu within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  const { preview, table } = await mixedActions(page);
  const scroller = table.locator("..");
  await expect(scroller).toHaveAttribute("role", "region");
  expect(await scroller.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  const more = await expectMatchedIcons(table, "代理 A");
  await expect(more).toBeInViewport();
  await more.click();
  const menu = page.getByRole("menu", { name: "更多操作：代理 A", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(3);
  await expectMenuInViewport(menu, 320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("mixed-actions-menu-320.png"), fullPage: true, animations: "disabled" });
  await menu.getByRole("menuitem", { name: "查看记录", exact: true }).click();
  const details = page.getByRole("dialog", { name: "代理记录", exact: true });
  await expect(details).toBeVisible();
  await expect(details).toContainText("proxy-a.example.com:8080/");
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await preview.screenshot({ path: test.info().outputPath("mixed-actions-320.png"), animations: "disabled" });
});

test("ordinary text DropdownMenu and attached SplitButton keep their existing labelled trigger behavior", async ({ page }) => {
  await page.goto("/#/components/menu");
  const preview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const text = preview.getByRole("button", { name: "下拉菜单", exact: true });
  await expect(text).toHaveClass(/ui-button--secondary/);
  await expect(text.locator(".ui-dropdown__trigger-label")).toHaveText("更多操作");
  await expect(text.locator("svg.lucide-chevron-down")).toHaveCount(1);
  await text.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "下拉菜单", exact: true });
  await expect(menu.getByRole("menuitem", { name: "打开", exact: true })).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: "归档", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(text).toBeFocused();
  await expect(menu).toHaveCount(0);

  await page.goto("/#/components/split-button");
  const splitPreview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const primary = splitPreview.getByRole("button", { name: "保存并发布", exact: true });
  const alternate = splitPreview.getByRole("button", { name: "更多保存方式", exact: true });
  await expect(primary).toHaveClass(/ui-split-button__primary/);
  await expect(alternate).toHaveAttribute("data-ui-owner", "Button");
  await expect(alternate).not.toHaveClass(/ui-icon-button/);
  await expect(alternate.locator("svg.lucide-chevron-down")).toHaveCount(1);
  const left = await bounds(primary);
  const right = await bounds(alternate);
  expect(right.height).toBeCloseTo(left.height, 0);
  expect(right.y).toBeCloseTo(left.y, 0);
  expect(Math.abs(right.x - left.x - left.width)).toBeLessThanOrEqual(1);
  await primary.click();
  await expect(splitPreview.getByRole("status")).toHaveText("已保存并发布");
  await alternate.focus();
  await page.keyboard.press("ArrowDown");
  const splitMenu = page.getByRole("menu", { name: "更多保存方式", exact: true });
  await expect(splitMenu.getByRole("menuitem", { name: "保存为草稿", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(splitMenu.getByRole("menuitem", { name: "保存为模板", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(splitPreview.getByRole("status")).toHaveText("已保存为模板");
  await expect(alternate).toBeFocused();
  await expect(splitMenu).toHaveCount(0);
  await splitPreview.screenshot({ path: test.info().outputPath("split-button-regression.png"), animations: "disabled" });
});
