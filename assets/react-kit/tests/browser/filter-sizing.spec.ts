// @ui-coverage {"kind":"browser","runner":"browser","exports":["FilterBar","FilterField"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function sizingCase(page: Page) {
  await page.goto("/#/components/filter-bar");
  await page.getByRole("tab", { name: "字段宽度与响应式预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "字段宽度与响应式预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const form = preview.getByRole("form", { name: "任务档案多字段筛选", exact: true });
  await expect(form).toBeVisible();
  return { preview, form };
}

async function hostWidth(page: Page, preview: Locator, width: number) {
  // Only the consumer-owned outer demo host is resized; protected controls remain untouched.
  await page.locator(".demo-explorer-main").evaluate((node) => { node.style.width = "1600px"; });
  await preview.evaluate((node, hostWidth) => { node.style.width = `${hostWidth}px`; node.style.maxWidth = "100%"; }, width);
}

function controls(form: Locator) {
  return [
    form.getByRole("searchbox", { name: "任务编号", exact: true }).locator(".."),
    form.getByRole("combobox", { name: /^任务状态/ }),
    form.getByRole("searchbox", { name: "任务类型", exact: true }).locator(".."),
    form.getByRole("searchbox", { name: "国家代码", exact: true }).locator(".."),
    form.getByRole("searchbox", { name: "号码", exact: true }).locator(".."),
  ];
}

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("different field widths keep actions on the same wide row and explicit pending queries stable", async ({ page }) => {
  const { preview, form } = await sizingCase(page);
  await hostWidth(page, preview, 1400);
  const expectedWidths = [220, 140, 180, 140, 240];
  const fieldControls = controls(form);
  const action = form.getByRole("button", { name: "查询", exact: true });
  const reset = form.getByRole("button", { name: "重置", exact: true });
  const initial = await Promise.all(fieldControls.map(bounds));
  for (const [index, box] of initial.entries()) {
    if (index === 3) {
      expect(box.width).toBeGreaterThanOrEqual(expectedWidths[index]);
      expect(box.width).toBeLessThanOrEqual(360);
    } else {
      expect(box.width).toBeCloseTo(expectedWidths[index], 0);
    }
    expect(box.height).toBeCloseTo(38, 0);
    expect(box.y).toBeCloseTo(initial[0].y, 0);
  }
  const idleAction = await bounds(action);
  expect(idleAction.y).toBeCloseTo(initial[0].y, 0);
  expect(idleAction.x).toBeGreaterThan(initial[4].x + initial[4].width);
  expect(idleAction.height).toBeCloseTo(38, 0);
  const task = form.getByRole("searchbox", { name: "任务编号", exact: true });
  await task.fill("260901");
  await expect(form.getByRole("status")).toContainText("共 3 条结果");
  expect((await bounds(fieldControls[0])).width).toBe(initial[0].width);
  await action.click();
  await expect(action).toHaveAttribute("aria-busy", "true");
  await expect(action).toHaveAttribute("aria-disabled", "true");
  await expect(reset).toBeDisabled();
  const pendingAction = await bounds(action);
  expect(pendingAction.width).toBe(idleAction.width);
  expect(pendingAction.height).toBe(idleAction.height);
  await task.fill("260902");
  await task.press("Enter");
  await expect(form.getByRole("status")).toContainText("已完成 1 次查询；共 1 条结果；已应用任务编号：260901");
  expect((await bounds(action)).width).toBe(idleAction.width);
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(task).toHaveValue("");
  await expect(form.getByRole("status")).toHaveText("已完成 0 次查询；共 3 条结果；已应用任务编号：全部");
  await noPageOverflow(page);
  await preview.screenshot({ path: test.info().outputPath("filter-sizing-desktop.png"), animations: "disabled" });
});

test("five fields and query actions wrap within an 800px host and become full width at 320px", async ({ page }) => {
  const { preview, form } = await sizingCase(page);
  await hostWidth(page, preview, 800);
  const fieldControls = controls(form);
  const boxes = await Promise.all(fieldControls.map(bounds));
  expect(boxes[4].y).toBeGreaterThan(boxes[0].y);
  for (const [index, box] of boxes.entries()) {
    if (index === 3) {
      expect(box.width).toBeGreaterThanOrEqual(140);
      expect(box.width).toBeLessThanOrEqual(360);
    } else {
      expect(box.width).toBeCloseTo([220, 140, 180, 140, 240][index], 0);
    }
  }
  const query = form.getByRole("button", { name: "查询", exact: true });
  const reset = form.getByRole("button", { name: "重置", exact: true });
  const queryBox = await bounds(query);
  expect(queryBox.y).toBeCloseTo(boxes[4].y, 0);
  expect(queryBox.x).toBeGreaterThan(boxes[4].x + boxes[4].width);
  await page.setViewportSize({ width: 320, height: 1100 });
  // Remove the desktop-only outer-host experiment for the real mobile viewport.
  await page.locator(".demo-explorer-main").evaluate((node) => { node.style.removeProperty("width"); });
  const formBox = await bounds(form);
  const mobileBoxes = await Promise.all(fieldControls.map(bounds));
  for (const [index, box] of mobileBoxes.entries()) {
    expect(box.width).toBeCloseTo(formBox.width, 0);
    expect(box.height).toBeCloseTo(44, 0);
    if (index) expect(box.y).toBeGreaterThanOrEqual(mobileBoxes[index - 1].y + mobileBoxes[index - 1].height);
  }
  expect((await bounds(query)).height).toBeCloseTo(44, 0);
  expect((await bounds(reset)).height).toBeCloseTo(44, 0);
  await noPageOverflow(page);
  await form.getByRole("searchbox", { name: "国家代码", exact: true }).fill("GB");
  await query.click();
  await expect(form.getByRole("status")).toContainText("已完成 1 次查询；共 1 条结果");
  await preview.screenshot({ path: test.info().outputPath("filter-sizing-320.png"), animations: "disabled" });
});

test("legacy single fields retain 320px and labeled hints align controls with Enter submission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#/components/filter-bar");
  const panel = page.getByRole("tabpanel", { name: "筛选栏预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const legacy = preview.getByRole("form", { name: "成员筛选", exact: true });
  const legacyInput = legacy.getByRole("searchbox", { name: "搜索成员", exact: true }).locator("..");
  expect((await bounds(legacyInput)).width).toBeCloseTo(320, 0);
  expect((await bounds(legacyInput)).height).toBeCloseTo(38, 0);
  const labeled = preview.getByRole("form", { name: "带提示的成员筛选", exact: true });
  const name = labeled.getByRole("searchbox", { name: "成员姓名", exact: true });
  const select = labeled.getByRole("combobox", { name: /^认证状态/ });
  const action = labeled.getByRole("button", { name: "应用筛选", exact: true });
  await expect.poll(async () => Math.abs((await bounds(name.locator(".."))).y - (await bounds(select)).y)).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await bounds(action)).y - (await bounds(select)).y)).toBeLessThanOrEqual(1);
  await expect(name).toHaveAccessibleDescription(/仅编辑查询草稿/);
  await expect(select).toHaveAttribute("aria-invalid", "true");
  await name.fill("lin");
  await name.press("Enter");
  await expect(labeled.getByRole("status")).toContainText("已应用筛选：lin；待认证");
});
