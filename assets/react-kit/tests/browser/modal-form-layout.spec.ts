// @ui-coverage {"kind":"browser","runner":"browser","exports":["Dialog","Field","Form","Grid"]}
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function openForm(page: Page, state = "默认") {
  await page.goto("/#/components/dialog");
  await page.getByRole("tab", { name: state, exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: state, exact: true });
  await preview.getByRole("button", { name: "编辑项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "编辑项目", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("..")).toHaveAttribute("data-ui-motion", "open");
  return dialog;
}

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

test("modal form pairs fields by panel width and keeps native footer submission visible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const dialog = await openForm(page);
  const body = dialog.locator(".ui-dialog__body");
  const footer = dialog.locator(".ui-dialog__footer");
  const form = dialog.locator("form");
  const save = footer.getByRole("button", { name: "保存", exact: true });
  expect(await save.evaluate((node: HTMLButtonElement) => node.form?.id)).toBe(await form.getAttribute("id"));
  await expect(body.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);

  for (const viewport of [{ width: 1280, height: 720 }, { width: 320, height: 640 }, { width: 1280, height: 420 }]) {
    await page.setViewportSize(viewport);
    const panelBox = await box(dialog);
    const before = await box(footer);
    expect(before.y + before.height).toBeLessThanOrEqual(viewport.height);
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width);
    for (const grid of await form.locator(".ui-grid").all()) {
      const fields = grid.locator('[data-ui-owner="Field"]');
      const first = await box(fields.nth(0)), second = await box(fields.nth(1));
      if ((await box(grid)).width >= 416) {
        expect(first.y).toBeCloseTo(second.y, 0);
        expect(second.x - first.x - first.width).toBeCloseTo(16, 0);
        expect(first.width).toBeCloseTo(second.width, 0);
      } else {
        expect(second.y).toBeGreaterThan(first.y);
        expect(second.x).toBeCloseTo(first.x, 0);
      }
    }
    await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
    expect((await box(footer)).y).toBeCloseTo(before.y, 0);
    expect(await body.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: test.info().outputPath(`modal-form-${viewport.width}-${viewport.height}.png`), animations: "disabled" });
  }

  const name = dialog.getByRole("textbox", { name: /^项目名称/ });
  await name.fill("");
  await save.click();
  await expect(dialog).toBeVisible();
  await expect(name).toBeFocused();
  expect(await name.evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
  await name.fill("连接配置");
  await name.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: "默认", exact: true }).getByRole("button", { name: "编辑项目", exact: true })).toBeFocused();
  await page.getByRole("tabpanel", { name: "默认", exact: true }).getByRole("button", { name: "编辑项目", exact: true }).click();
  await save.click();
  await expect(dialog).toBeHidden();
});

test("modal required markers blend with light and dark surfaces without contrast regressions", async ({ page }) => {
  await page.setViewportSize({ width: 736, height: 1000 });
  for (const state of ["默认", "深色模式"]) {
    const dialog = await openForm(page, state);
    const markers = dialog.locator(".ui-label__required");
    await expect(markers).toHaveCount(2);
    const backgrounds = await markers.evaluateAll(nodes => nodes.map(node => {
      const marker = getComputedStyle(node).backgroundColor;
      const surface = getComputedStyle(node.closest('[role="dialog"]')!).backgroundColor;
      return { marker, surface };
    }));
    for (const { marker, surface } of backgrounds) {
      expect(marker === "rgba(0, 0, 0, 0)" || marker === surface).toBe(true);
    }
    const contrast = await new AxeBuilder({ page }).include('[role="dialog"]').withRules(["color-contrast"]).analyze();
    expect(contrast.violations).toEqual([]);
    expect(contrast.incomplete.filter(result => result.nodes.some(node => node.target.some(target => String(target).includes("ui-label__required"))))).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`modal-required-${state}.png`), animations: "disabled" });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toBeHidden();
  }
});
