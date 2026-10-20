// @ui-coverage {"kind":"browser","runner":"browser","exports":["AuthenticationPage","FilterBar","Button"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page, family: string, state = "默认") {
  await page.goto(`/#/${["authentication", "list-filter"].includes(family) ? "patterns" : "components"}/${family}`);
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}
async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}
async function capture(node: Locator, name: string) {
  await node.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("generic authentication centers a bounded form without blank columns and submits with Enter", async ({ page }) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const preview = await previewFor(page, "authentication");
    await preview.getByRole("tab", { name: "通用认证页", exact: true }).click();
    const auth = preview.getByRole("tabpanel", { name: "通用认证页", exact: true }).locator('[data-ui-owner="AuthenticationPage"]');
    const content = auth.locator(".ui-auth-page__content");
    const input = auth.getByRole("textbox", { name: "邮箱", exact: true });
    const action = auth.getByRole("button", { name: "继续", exact: true });
    const shell = await bounds(auth);
    const form = await bounds(content);
    const field = await bounds(input);
    const button = await bounds(action);
    expect(form.width).toBeLessThanOrEqual(420);
    expect(Math.abs(form.x + form.width / 2 - shell.x - shell.width / 2)).toBeLessThanOrEqual(1);
    expect(shell.height).toBeLessThanOrEqual(561);
    expect(button.y - field.y - field.height).toBeGreaterThanOrEqual(16);
    expect(button.height).toBe(44);
    await expect(auth.locator(".ui-auth-page__visual")).toHaveCount(0);
    await input.fill("demo@example.com");
    await input.press("Enter");
    await expect(auth.getByRole("status")).toHaveText("已使用 demo@example.com 继续");
    await noOverflow(page);
    await capture(auth, `generic-${width}`);
  }
});

test("authentication illustration responds to its container and long content stays readable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page, "authentication");
  await preview.getByRole("tab", { name: "带插画认证页", exact: true }).click();
  const auth = preview.getByRole("tabpanel", { name: "带插画认证页", exact: true }).locator('[data-ui-owner="AuthenticationPage"]');
  const visual = auth.locator(".ui-auth-page__visual");
  const form = auth.locator(".ui-auth-page__form");
  await expect(visual).toBeVisible();
  const art = await bounds(visual);
  const panel = await bounds(form);
  expect(panel.x).toBeGreaterThanOrEqual(art.x + art.width - 1);
  await capture(auth, "illustrated-desktop");
  // Only the outside host changes; canonical pattern styles remain untouched.
  await preview.evaluate(node => { node.style.width = "320px"; node.style.maxWidth = "100%"; });
  await expect(visual).toBeHidden();
  expect((await bounds(form)).width).toBeLessThanOrEqual(320);
  await capture(auth, "illustrated-narrow-container");
  await page.setViewportSize({ width: 320, height: 900 });
  const longPreview = await previewFor(page, "authentication", "长内容");
  const longAuth = longPreview.getByRole("tabpanel", { name: "通用认证页", exact: true }).locator('[data-ui-owner="AuthenticationPage"]');
  await expect(longAuth).toContainText("请确认所有关联配置均符合团队的实际使用要求");
  expect((await bounds(longAuth.locator(".ui-auth-page__content"))).width).toBeLessThanOrEqual(272);
  await noOverflow(page);
  await capture(longAuth, "long-auth-320");
});

test("query controls use compact aligned primary actions and keep explicit draft submission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const preview = await previewFor(page, "filter-bar");
  const input = preview.getByRole("searchbox", { name: "搜索成员", exact: true });
  const action = preview.getByRole("button", { name: "查询", exact: true });
  const field = await bounds(input.locator(".."));
  const button = await bounds(action);
  expect(field.width).toBe(320);
  expect(field.height).toBe(38);
  expect(button.height).toBe(38);
  await expect(action).toHaveClass(/ui-button--primary/);
  await expect(action.locator(".ui-button__icon svg")).toHaveCount(1);
  // Search icon, label and control padding share a content-sized action; no full-row stretching.
  expect(button.width).toBeGreaterThanOrEqual(74);
  expect(button.width).toBeLessThanOrEqual(96);
  expect(Math.abs(button.y - field.y)).toBeLessThanOrEqual(1);
  expect(button.x - field.x - field.width).toBeGreaterThanOrEqual(10);
  expect(button.x - field.x - field.width).toBeLessThanOrEqual(12);
  await input.fill("lin");
  await expect(preview.getByRole("status")).toContainText("共 3 条结果");
  await capture(preview, "compact-query-desktop");
  await input.press("Enter");
  await expect(preview.getByRole("status")).toContainText("共 1 条结果；林夏");
  await page.setViewportSize({ width: 320, height: 900 });
  await noOverflow(page);
  expect((await bounds(input.locator(".."))).width).toBeLessThanOrEqual(280);
  expect((await bounds(action)).height).toBe(44);
  await capture(preview, "compact-query-320");
  await page.setViewportSize({ width: 1440, height: 900 });
  const listPreview = await previewFor(page, "list-filter");
  await listPreview.getByRole("tab", { name: "列表管理", exact: true }).click();
  const listAction = listPreview.getByRole("button", { name: "查询", exact: true });
  expect((await bounds(listAction)).width).toBeLessThanOrEqual(96);
  expect((await bounds(listAction)).height).toBe(38);
  await expect(listAction).toHaveClass(/ui-button--primary/);
  await expect(listAction.locator(".ui-button__icon svg")).toHaveCount(1);
  await noOverflow(page);
  const keyboardPreview = await previewFor(page, "filter-bar", "键盘操作");
  const keyboardInput = keyboardPreview.getByRole("searchbox", { name: "搜索成员", exact: true });
  const keyboardAction = keyboardPreview.getByRole("button", { name: "查询", exact: true });
  expect((await bounds(keyboardInput.locator(".."))).height).toBe(38);
  expect((await bounds(keyboardAction)).height).toBe(38);
  expect((await bounds(keyboardAction)).width).toBeLessThanOrEqual(96);
  await keyboardInput.fill("lin");
  await keyboardInput.press("Tab");
  await expect(keyboardAction).toBeFocused();
  await keyboardAction.press("Enter");
  await expect(keyboardPreview.getByRole("status")).toContainText("共 1 条结果；林夏");
  await capture(keyboardPreview, "compact-query-keyboard");
  const comfortablePreview = await previewFor(page, "filter-bar", "长内容");
  expect((await bounds(comfortablePreview.getByRole("searchbox", { name: "搜索成员", exact: true }).locator(".."))).height).toBe(44);
  expect((await bounds(comfortablePreview.getByRole("button", { name: "查询", exact: true }))).height).toBe(44);
});

test("query pending state shows a spinner without resizing or accepting a second draft", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const preview = await previewFor(page, "filter-bar");
  const input = preview.getByRole("searchbox", { name: "搜索成员", exact: true });
  const action = preview.getByRole("button", { name: "查询", exact: true });
  const idle = await bounds(action);
  await input.fill("lin");
  await action.click();
  await expect(action).toHaveAttribute("aria-busy", "true");
  await expect(action).toHaveAttribute("aria-disabled", "true");
  await expect(action.locator(".ui-button__loading .ui-spinner")).toBeVisible();
  await expect(preview.getByRole("status")).toContainText("正在查询；共 3 条结果");
  const pending = await bounds(action);
  expect(pending.width).toBe(idle.width);
  expect(pending.height).toBe(idle.height);
  await input.fill("chen");
  await input.press("Enter");
  await capture(preview, "query-pending");
  await expect(action).not.toHaveAttribute("aria-busy", "true");
  await expect(preview.getByRole("status")).toContainText("共 1 条结果；林夏");
  const complete = await bounds(action);
  expect(complete.width).toBe(idle.width);
  expect(complete.height).toBe(idle.height);
});
