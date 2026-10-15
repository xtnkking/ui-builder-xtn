// @ui-coverage {"kind":"browser","runner":"browser","exports":["FilterBar","FilterField","SearchInput"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function textRoom(input: Locator) {
  return input.evaluate((node: HTMLInputElement) => {
    const style = getComputedStyle(node);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.font = style.font;
    const placeholder = node.placeholder;
    const spacing = Number.parseFloat(style.letterSpacing) || 0;
    return {
      available: node.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
      required: context.measureText(placeholder).width + spacing * Math.max(0, Array.from(placeholder).length - 1),
      fontSize: Number.parseFloat(style.fontSize),
    };
  });
}

async function expectHintFits(input: Locator) {
  await expect.poll(async () => {
    const room = await textRoom(input);
    return room.available - room.required;
  }).toBeGreaterThanOrEqual(-1);
}

async function sizingCase(page: Page) {
  await page.goto("/#/components/filter-bar");
  await page.getByRole("tab", { name: "字段宽度与响应式预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "字段宽度与响应式预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const form = preview.getByRole("form", { name: "任务档案多字段筛选", exact: true });
  await expect(form).toBeVisible();
  return { panel, preview, form };
}

async function hostWidth(page: Page, preview: Locator, width: number) {
  // Change only the consumer-owned demo layout, never protected component styles.
  await page.locator(".demo-explorer-main").evaluate((node) => { node.style.width = "1600px"; });
  await preview.evaluate((node, nextWidth) => { node.style.width = `${nextWidth}px`; node.style.maxWidth = "100%"; }, width);
}

function fields(form: Locator) {
  return [
    form.getByRole("searchbox", { name: "任务编号", exact: true }).locator(".."),
    form.getByRole("combobox", { name: /^任务状态/ }),
    form.getByRole("searchbox", { name: "任务类型", exact: true }).locator(".."),
    form.getByRole("searchbox", { name: "国家代码", exact: true }).locator(".."),
    form.getByRole("searchbox", { name: "号码", exact: true }).locator(".."),
  ];
}

test("six-character hint fits with reserved clear space while values and explicit numeric widths stay stable", async ({ page }) => {
  const { preview, form } = await sizingCase(page);
  await hostWidth(page, preview, 1400);
  const country = form.getByRole("searchbox", { name: "国家代码", exact: true });
  await expect(country).toHaveAttribute("placeholder", "输入国家代码");
  await expectHintFits(country);
  const shell = country.locator("..");
  const original = await bounds(shell);
  expect(original.width).toBeGreaterThan(140);
  expect(original.width).toBeLessThanOrEqual(360);
  await expect(shell.locator(".ui-input-shell__start")).toBeVisible();
  await expect(shell.locator(".ui-input-action")).toHaveAttribute("aria-hidden", "true");
  expect((await bounds(form.getByRole("searchbox", { name: "任务编号", exact: true }).locator(".."))).width).toBeCloseTo(220, 0);
  expect((await bounds(form.getByRole("searchbox", { name: "任务类型", exact: true }).locator(".."))).width).toBeCloseTo(180, 0);

  await country.fill("GB");
  const clear = shell.getByRole("button", { name: "清除搜索", exact: true });
  await expect(clear).toBeVisible();
  expect((await bounds(shell)).width).toBeCloseTo(original.width, 0);
  await country.fill("A very long typed value must never resize this field".repeat(3));
  expect((await bounds(shell)).width).toBeCloseTo(original.width, 0);
  await clear.click();
  await expect(country).toHaveValue("");
  await expectHintFits(country);
  expect((await bounds(shell)).width).toBeCloseTo(original.width, 0);
  await preview.screenshot({ path: test.info().outputPath("filter-hint-desktop.png"), animations: "disabled" });

  // The existing legacy composition has no clear action or trailing slot.
  await page.getByRole("tab", { name: "筛选栏预览", exact: true }).click();
  const legacy = page.getByRole("tabpanel", { name: "筛选栏预览", exact: true })
    .getByRole("tabpanel", { name: "总览", exact: true })
    .getByRole("form", { name: "成员筛选", exact: true });
  const keyword = legacy.getByRole("searchbox", { name: "搜索成员", exact: true });
  await expect(keyword.locator("..").locator(".ui-input-shell__end")).toHaveCount(0);
  await expectHintFits(keyword);
  expect((await bounds(keyword.locator(".."))).width).toBeCloseTo(320, 0);
});

test("placeholder measurement follows inherited font, English and dark contexts while long hints keep a 360px cap", async ({ page }) => {
  const { panel, preview, form } = await sizingCase(page);
  await hostWidth(page, preview, 1400);
  const country = form.getByRole("searchbox", { name: "国家代码", exact: true });
  await expectHintFits(country);
  const normalBackground = await country.locator("..").evaluate((node) => getComputedStyle(node).backgroundColor);

  await panel.getByRole("tab", { name: "多语言", exact: true }).click();
  const english = panel.getByRole("tabpanel", { name: "多语言", exact: true })
    .getByRole("form", { name: "Task archive filters", exact: true });
  const englishCountry = english.getByRole("searchbox", { name: "Country code", exact: true });
  await expect(englishCountry).toHaveAttribute("placeholder", "Enter country code");
  await expectHintFits(englishCountry);
  expect((await bounds(englishCountry.locator(".."))).width).toBeGreaterThan(140);
  expect((await bounds(englishCountry.locator(".."))).width).toBeLessThanOrEqual(360);
  // Input size is intentionally fixed at 14px; weight actually inherits from its host.
  const englishPreview = panel.getByRole("tabpanel", { name: "多语言", exact: true }).locator(".demo-explorer-preview");
  await englishPreview.evaluate((node) => { node.style.fontWeight = "700"; });
  await expect.poll(() => englishCountry.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
  await expectHintFits(englishCountry);
  expect((await bounds(english.getByRole("searchbox", { name: "Task ID", exact: true }).locator(".."))).width).toBeCloseTo(220, 0);

  await panel.getByRole("tab", { name: "深色模式", exact: true }).click();
  const dark = panel.getByRole("tabpanel", { name: "深色模式", exact: true })
    .getByRole("form", { name: "任务档案多字段筛选", exact: true });
  const darkCountry = dark.getByRole("searchbox", { name: "国家代码", exact: true });
  await expectHintFits(darkCountry);
  expect(await darkCountry.locator("..").evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(normalBackground);

  await panel.getByRole("tab", { name: "长内容", exact: true }).click();
  const longPreview = panel.getByRole("tabpanel", { name: "长内容", exact: true }).locator(".demo-explorer-preview");
  await hostWidth(page, longPreview, 1400);
  const longHint = longPreview.getByRole("searchbox", { name: "号码", exact: true });
  await expect.poll(async () => (await bounds(longHint.locator(".."))).width).toBeCloseTo(360, 0);
  const room = await textRoom(longHint);
  expect(room.required).toBeGreaterThan(room.available);
  expect(await longPreview.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await longPreview.screenshot({ path: test.info().outputPath("filter-hint-bounded-long.png"), animations: "disabled" });
});

test("expanded fields wrap at 800px and stay full width with usable 44px actions at 320px", async ({ page }) => {
  const { preview, form } = await sizingCase(page);
  await hostWidth(page, preview, 800);
  const controls = fields(form);
  await expectHintFits(form.getByRole("searchbox", { name: "国家代码", exact: true }));
  const wrapped = await Promise.all(controls.map(bounds));
  expect(wrapped[4].y).toBeGreaterThan(wrapped[0].y);
  const host = await bounds(form);
  for (const box of wrapped) {
    expect(box.x).toBeGreaterThanOrEqual(host.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(host.x + host.width + 1);
  }
  await page.setViewportSize({ width: 320, height: 1100 });
  await page.locator(".demo-explorer-main").evaluate((node) => { node.style.removeProperty("width"); });
  const mobileHost = await bounds(form);
  const mobile = await Promise.all(controls.map(bounds));
  for (const [index, box] of mobile.entries()) {
    expect(box.width).toBeCloseTo(mobileHost.width, 0);
    expect(box.height).toBeCloseTo(44, 0);
    if (index) expect(box.y).toBeGreaterThanOrEqual(mobile[index - 1].y + mobile[index - 1].height);
  }
  const query = form.getByRole("button", { name: "查询", exact: true });
  const reset = form.getByRole("button", { name: "重置", exact: true });
  expect((await bounds(query)).height).toBeCloseTo(44, 0);
  expect((await bounds(reset)).height).toBeCloseTo(44, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await form.getByRole("searchbox", { name: "国家代码", exact: true }).fill("GB");
  await query.click();
  await expect(form.getByRole("status")).toContainText("已完成 1 次查询；共 1 条结果");
  await reset.click();
  await expect(form.getByRole("searchbox", { name: "国家代码", exact: true })).toHaveValue("");
  await expect(form.getByRole("status")).toContainText("已完成 0 次查询；共 3 条结果");
  await preview.screenshot({ path: test.info().outputPath("filter-hint-320.png"), animations: "disabled" });
});
