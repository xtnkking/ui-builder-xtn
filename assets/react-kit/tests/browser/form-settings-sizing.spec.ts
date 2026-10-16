// @ui-coverage {"kind":"browser","runner":"browser","exports":["Field","Form","SettingsPage","NumberInput"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function settingsPreview(page: Page, state = "默认") {
  await page.goto("/#/patterns/settings");
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}

async function noOverflow(page: Page, preview: Locator) {
  expect(await preview.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("numeric settings keep short controls and a compact save button across six widths and pending save", async ({ page }) => {
  const preview = await settingsPreview(page);
  const settings = preview.locator('[data-ui-owner="SettingsPage"]');
  const content = settings.locator(".ui-settings-page__content");
  const form = settings.getByRole("form", { name: "任务限制设置", exact: true });
  const fields = form.locator('[data-ui-owner="NumberInput"]');
  const save = form.getByRole("button", { name: "保存设置", exact: true });
  await expect(fields).toHaveCount(4);
  for (const width of [2560, 1440, 1024, 736, 360, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const available = await bounds(content);
    expect(available.width).toBeLessThanOrEqual(800);
    const controls = await Promise.all((await fields.all()).map(bounds));
    for (const control of controls) {
      expect(control.width).toBeCloseTo(Math.min(240, available.width), 0);
      expect(control.height).toBeCloseTo(44, 0);
      expect(control.x).toBeGreaterThanOrEqual(available.x - 1);
      expect(control.x + control.width).toBeLessThanOrEqual(available.x + available.width + 1);
    }
    if (available.width >= 504) {
      expect(controls[1].y).toBeCloseTo(controls[0].y, 0);
      expect(controls[2].y).toBeGreaterThan(controls[0].y);
      expect(controls[3].y).toBeCloseTo(controls[2].y, 0);
      // Measure the visible controls, not just Grid's declared gap: free space
      // inside a stretched track previously left a gap of roughly170px here.
      expect(controls[1].x - controls[0].x - controls[0].width).toBeCloseTo(24, 0);
      expect(controls[3].x - controls[2].x - controls[2].width).toBeCloseTo(24, 0);
    } else {
      for (let index = 1; index < controls.length; index += 1) {
        expect(controls[index].y).toBeGreaterThan(controls[index - 1].y);
        expect(controls[index].x).toBeCloseTo(controls[0].x, 0);
      }
    }
    expect(controls[0].x).toBeCloseTo(available.x, 0);
    const button = await bounds(save);
    expect(button.width).toBeLessThanOrEqual(180);
    expect(button.height).toBeCloseTo(44, 0);
    await noOverflow(page, preview);
    if (width === 2560 || width === 320) {
      await preview.screenshot({ path: test.info().outputPath(`settings-${width}.png`), animations: "disabled" });
    }
  }

  const before = await bounds(save);
  await form.getByRole("spinbutton").first().fill("750");
  await save.click();
  await expect(form).toHaveAttribute("aria-busy", "true");
  const pending = form.getByRole("button", { name: "正在保存", exact: true });
  await expect(pending).toHaveAttribute("aria-disabled", "true");
  const pendingBox = await bounds(pending);
  expect(pendingBox.width).toBeCloseTo(before.width, 0);
  expect(pendingBox.height).toBeCloseTo(before.height, 0);
  await expect(form.getByRole("spinbutton").first()).toBeDisabled();
  await expect(page.getByText("任务限制已保存", { exact: true })).toHaveCount(1);
  await expect(form).not.toHaveAttribute("aria-busy", "true");
  await expect(form.getByRole("spinbutton").first()).toHaveValue("750");
  expect((await bounds(save)).width).toBeCloseTo(before.width, 0);
});

test("long labels wrap in a narrow settings container and ordinary form fields preserve their intended widths", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const longPreview = await settingsPreview(page, "长内容");
  // Resize only the outside demo host to exercise embedding at desktop viewport size.
  await longPreview.evaluate((node) => { node.style.width = "320px"; node.style.maxWidth = "100%"; });
  const settings = longPreview.locator('[data-ui-owner="SettingsPage"]');
  const content = settings.locator(".ui-settings-page__content");
  const navigation = settings.getByRole("navigation", { name: "设置分类", exact: true });
  const available = await bounds(content);
  const navBox = await bounds(navigation);
  expect(available.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
  const title = content.getByRole("heading", { name: "WorkspaceAutomationTaskProcessingConcurrencyAndImportLimits", exact: true });
  const headerAction = content.getByRole("button", { name: "查看基本信息", exact: true });
  const titleBox = await bounds(title);
  const actionBox = await bounds(headerAction);
  expect(titleBox.height).toBeGreaterThan(32);
  for (const box of [titleBox, actionBox]) {
    expect(box.x).toBeGreaterThanOrEqual(available.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(available.x + available.width + 1);
  }
  expect(actionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
  expect(actionBox.height).toBeCloseTo(44, 0);
  const fields = settings.locator('[data-ui-owner="Field"]');
  await expect(fields).toHaveCount(4);
  for (const field of await fields.all()) {
    const box = await bounds(field);
    const label = await bounds(field.locator(".ui-label"));
    const control = await bounds(field.locator('[data-ui-owner="NumberInput"]'));
    const hint = await bounds(field.locator(".ui-field__hint"));
    expect(box.width).toBeCloseTo(240, 0);
    expect(label.height).toBeGreaterThan(24);
    expect(control.y).toBeGreaterThanOrEqual(label.y + label.height + 6);
    expect(hint.y).toBeGreaterThanOrEqual(control.y + control.height + 6);
    expect(hint.x + hint.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
  await noOverflow(page, longPreview);
  await longPreview.screenshot({ path: test.info().outputPath("settings-long-320-container.png"), animations: "disabled" });
  await headerAction.focus();
  await expect(headerAction).toBeFocused();
  await headerAction.press("Enter");
  await expect(longPreview.getByRole("form", { name: "工作区基本信息", exact: true })).toBeVisible();

  const preview = await settingsPreview(page);
  await preview.getByRole("button", { name: "基本信息", exact: true }).click();
  const profile = preview.getByRole("form", { name: "工作区基本信息", exact: true });
  const profileWidth = (await bounds(profile)).width;
  const name = profile.getByRole("textbox", { name: "工作区名称", exact: true });
  const service = profile.getByRole("textbox", { name: "服务地址", exact: true });
  const notes = profile.getByRole("textbox", { name: "备注", exact: true });
  expect((await bounds(name)).width).toBeCloseTo(Math.min(360, profileWidth), 0);
  expect((await bounds(service)).width).toBeCloseTo(Math.min(560, profileWidth), 0);
  expect((await bounds(notes)).width).toBeCloseTo(profileWidth, 0);
  const original = await bounds(name);
  await name.fill("Long workspace names must never resize the field".repeat(3));
  expect((await bounds(name)).width).toBeCloseTo(original.width, 0);
  await page.setViewportSize({ width: 320, height: 1000 });
  const narrowWidth = (await bounds(profile)).width;
  for (const control of [name, service, notes]) expect((await bounds(control)).width).toBeCloseTo(narrowWidth, 0);
  await noOverflow(page, preview);
});
