// @ui-coverage {"kind":"browser","runner":"browser","exports":["DataTable","IconButton","Tooltip","DropdownMenu","ConfirmDialog"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function actionCase(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "操作列组合预览", exact: true }).click();
  const casePanel = page.getByRole("tabpanel", { name: "操作列组合预览", exact: true });
  const preview = casePanel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const table = preview.getByRole("table", { name: "代理操作示例", exact: true });
  await expect(table).toBeVisible();
  return { casePanel, preview, table };
}

async function iconGeometry(button: Locator) {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeCloseTo(36, 0);
  expect(box!.height).toBeCloseTo(36, 0);
  return box!;
}

async function expectCompactActions(table: Locator) {
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  const heights = await rows.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeCloseTo(58, 0);
  for (const name of ["代理 A", "代理 B", "只读代理"]) {
    const check = await iconGeometry(table.getByRole("button", { name: `检测${name}`, exact: true }));
    const edit = await iconGeometry(table.getByRole("button", { name: `编辑${name}`, exact: true }));
    const remove = await iconGeometry(table.getByRole("button", { name: `删除${name}`, exact: true }));
    expect(remove.y).toBeCloseTo(edit.y, 0);
    expect(check.y).toBeCloseTo(edit.y, 0);
    expect(edit.x - check.x - check.width).toBeGreaterThanOrEqual(0);
    expect(edit.x - check.x - check.width).toBeLessThanOrEqual(8);
    expect(remove.x).toBeGreaterThan(edit.x + edit.width);
    expect(remove.x - edit.x - edit.width).toBeLessThanOrEqual(8);
  }
}

test("table actions keep three compact icons with keyboard tooltips, loading and disabled permissions", async ({ page }) => {
  const { preview, table } = await actionCase(page);
  await expectCompactActions(table);
  await expect(table.getByRole("button", { name: "编辑只读代理", exact: true })).toBeDisabled();
  await expect(table.getByRole("button", { name: "删除只读代理", exact: true })).toBeDisabled();
  await expect(table.getByRole("button", { name: "检测只读代理", exact: true })).toBeEnabled();
  const check = table.getByRole("button", { name: "检测代理 A", exact: true });
  await check.focus();
  await expect(page.getByRole("tooltip", { name: "检测连接", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(check).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Enter");
  await expect(check).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".ui-toast").filter({ hasText: "连接检查完成" })).toHaveCount(1);
  const edit = table.getByRole("button", { name: "编辑代理 A", exact: true });
  const remove = table.getByRole("button", { name: "删除代理 A", exact: true });
  await edit.focus();
  await expect(edit).toBeFocused();
  await expect(page.getByRole("tooltip", { name: "编辑", exact: true })).toBeVisible();
  await expect(edit).toHaveAccessibleDescription("编辑");
  await page.keyboard.press("Tab");
  await expect(remove).toBeFocused();
  await expect(page.getByRole("tooltip", { name: "删除", exact: true })).toBeVisible();
  await expect(remove).toHaveAccessibleDescription("删除");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip", { name: "删除", exact: true })).toHaveCount(0);
  await expect(remove).toBeFocused();
  await preview.screenshot({ path: test.info().outputPath("table-actions-1440.png"), animations: "disabled" });
});

test("overflow actions use a keyboard menu and edit or confirmed delete updates data once after loading", async ({ page }) => {
  const { casePanel } = await actionCase(page);
  await casePanel.getByRole("tab", { name: "长内容", exact: true }).click();
  const table = casePanel.getByRole("table", { name: "代理操作示例", exact: true });
  const menuButton = table.getByRole("button", { name: "更多操作：代理 A", exact: true });
  await menuButton.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "更多操作：代理 A", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(5);
  await expect(menu.getByRole("menuitem", { name: "编辑", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const editor = page.getByRole("dialog", { name: "编辑代理", exact: true });
  await expect(editor).toBeVisible();
  const renamed = "代理 A（已编辑）";
  await editor.getByRole("textbox", { name: "代理名称", exact: true }).fill(renamed);
  const save = editor.getByRole("button", { name: "保存修改", exact: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table).toContainText(renamed);
  await expect(page.locator(".ui-toast").filter({ hasText: "已保存修改" })).toHaveCount(1);

  const renamedMenuButton = table.getByRole("button", { name: `更多操作：${renamed}`, exact: true });
  await renamedMenuButton.click();
  await page.getByRole("menu", { name: `更多操作：${renamed}`, exact: true }).getByRole("menuitem", { name: "删除", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "删除代理", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(renamedMenuButton).toBeVisible();
  await renamedMenuButton.click();
  await page.getByRole("menu", { name: `更多操作：${renamed}`, exact: true }).getByRole("menuitem", { name: "删除", exact: true }).click();
  const confirm = confirmation.locator(".ui-confirm-actions").getByRole("button").nth(1);
  await expect(confirm).toHaveAccessibleName("删除代理");
  await confirm.click();
  await expect(confirm).toHaveAttribute("aria-busy", "true");
  await expect(confirmation.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(confirmation).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(renamedMenuButton).toHaveCount(0);
  await expect(page.locator(".ui-toast").filter({ hasText: "已删除代理" })).toHaveCount(1);
});

test("320px table scrolls within its frame and preserves action size and row height", async ({ page }) => {
  const { preview, table } = await actionCase(page, 320);
  const scroller = table.locator("..");
  await expect(scroller).toHaveAttribute("role", "region");
  await expect(scroller).toHaveAttribute("tabindex", "0");
  const frame = await scroller.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    overflow: element.scrollWidth > element.clientWidth,
  }));
  expect(frame.width).toBeLessThanOrEqual(320);
  expect(frame.overflow).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expectCompactActions(table);
  await scroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const remove = table.getByRole("button", { name: "删除代理 A", exact: true });
  await expect(remove).toBeInViewport();
  await preview.screenshot({ path: test.info().outputPath("table-actions-320.png"), animations: "disabled" });
  await remove.click();
  const confirmation = page.getByRole("dialog", { name: "删除代理", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(3);
});
