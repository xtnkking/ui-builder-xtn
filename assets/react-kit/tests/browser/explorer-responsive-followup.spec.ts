// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["SplitButton","FilterBar","Tag","TagInput","Pagination","Banner","InlineMessage","Lightbox","FocusTrap","Field","Toolbar"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1000 } });

async function previewFor(page: Page, id: string, state = "总览") {
  await page.goto(`/#/components/${id}`);
  await page.getByRole("tab", { name: state, exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: state, exact: true });
  await expect(panel).toBeVisible();
  return panel.locator(".demo-explorer-preview");
}
async function resizeHost(preview: Locator, width: number) {
  // Resize only the consumer's layout host; leave canonical control CSS intact.
  await preview.evaluate((node, value) => { node.style.width = `${value}px`; node.style.maxWidth = "100%"; }, width);
}
async function box(node: Locator) {
  await expect(node).toBeVisible();
  const result = await node.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}
async function noDocumentOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
async function capture(node: Locator, name: string) {
  await node.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}

test("split actions keep joined corners, a readable menu and bounded ellipsis as their host shrinks", async ({ page }) => {
  const preview = await previewFor(page, "split-button", "长内容");
  const split = preview.locator('[data-pui-owner="SplitButton"]');
  const primary = split.locator(".pui-split-button__primary");
  const menu = split.locator(".pui-split-button__menu > button");
  for (const width of [800, 280]) {
    await resizeHost(preview, width);
    const whole = await box(split);
    const a = await box(primary);
    const b = await box(menu);
    expect(whole.width).toBeLessThanOrEqual(360);
    expect(a.width).toBeGreaterThan(100);
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - 38)).toBeLessThanOrEqual(1);
    await expect(primary).toHaveCSS("border-top-right-radius", "0px");
    await expect(menu).toHaveCSS("border-top-left-radius", "0px");
    const label = primary.locator(".pui-button__label");
    expect(await label.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await expect(label).toHaveCSS("text-overflow", "ellipsis");
    await noDocumentOverflow(page);
    await capture(preview, `split-${width}`);
  }
  await menu.click();
  await expect(page.getByRole("menuitem", { name: "保存为草稿", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("filter fields stay compact on desktop and reflow in a narrow host without submitting drafts", async ({ page }) => {
  const preview = await previewFor(page, "filter-bar", "默认");
  const input = preview.getByRole("searchbox", { name: "搜索成员", exact: true });
  const action = preview.getByRole("button", { name: "查询", exact: true });
  await resizeHost(preview, 900);
  const wide = await box(input);
  const wideAction = await box(action);
  expect(wide.width).toBeLessThanOrEqual(360);
  expect(Math.abs(wide.y + wide.height - wideAction.y - wideAction.height)).toBeLessThanOrEqual(1);
  await input.fill("lin");
  await expect(preview.getByRole("status")).toContainText("共 3 条结果");
  await capture(preview, "filter-wide-draft");
  await resizeHost(preview, 280);
  const narrow = await box(input);
  const narrowAction = await box(action);
  expect(narrow.width).toBeLessThan(wide.width);
  expect(narrowAction.y).toBeGreaterThanOrEqual(narrow.y + narrow.height);
  await action.click();
  await expect(preview.getByRole("status")).toContainText("共 1 条结果");
  await noDocumentOverflow(page);
  await capture(preview, "filter-narrow-applied");
});

test("long tag input values keep bounded pills, full text and accessible removal at changing widths", async ({ page }) => {
  const preview = await previewFor(page, "tag-input", "长内容");
  const tags = preview.locator('[data-pui-owner="Tag"]');
  const tag = tags.first();
  const full = await tag.locator(".pui-tag__label").innerText();
  expect(full.length).toBeGreaterThan(80);
  for (const width of [900, 280]) {
    await resizeHost(preview, width);
    const bounds = await box(tag);
    expect(bounds.width).toBeLessThanOrEqual(321);
    const remove = tag.getByRole("button");
    const removeBox = await box(remove);
    expect(removeBox.width).toBeGreaterThanOrEqual(27);
    expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    await expect(tag).toHaveAttribute("title", full);
    await expect(tag.locator(".pui-tag__label")).toHaveCSS("text-overflow", "ellipsis");
    await capture(preview, `tag-input-${width}`);
  }
  const focusableLabel = tag.locator('[tabindex="0"]').first();
  await expect(focusableLabel).toBeVisible();
  await focusableLabel.focus();
  await expect(focusableLabel).toBeFocused();
  await tag.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(tags).toHaveCount(1);
  await tags.first().getByRole("button").click();
  await expect(tags).toHaveCount(0);
  const input = preview.getByRole("combobox", { name: "长标签", exact: true });
  for (let index = 0; index < 12; index += 1) {
    await input.fill(`enterprise-project-security-tag-${index}`);
    await input.press("Enter");
  }
  await expect(tags).toHaveCount(12);
  const control = preview.locator(".pui-tag-input__control");
  expect((await box(control)).height).toBeLessThanOrEqual(192);
  expect(await control.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const controlBox = await box(control);
  const inputBox = await box(input);
  expect(inputBox.y).toBeGreaterThanOrEqual(controlBox.y);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(controlBox.y + controlBox.height);
  await expect(input).toBeFocused();
  await capture(preview, "tag-input-many-bounded-height");
  await noDocumentOverflow(page);
  const invalidPreview = await previewFor(page, "tag-input", "校验");
  const invalidInput = invalidPreview.getByRole("combobox");
  await invalidInput.focus();
  await invalidInput.press("Enter");
  const invalidControl = invalidPreview.locator(".pui-tag-input__control");
  await expect(invalidInput).toHaveAttribute("aria-invalid", "true");
  await expect(invalidControl).toHaveCSS("box-shadow", /inset/);
  const errorFocus = await invalidControl.evaluate(node => {
    const style = getComputedStyle(node);
    return { shadow: style.boxShadow, border: style.borderColor };
  });
  expect(errorFocus.shadow).toContain(errorFocus.border);
  await capture(invalidPreview, "tag-input-invalid-focus");
});

test("text prefixes align with tag labels and nonremovable long tags remain bounded", async ({ page }) => {
  let preview = await previewFor(page, "tag", "默认");
  const country = preview.locator('[data-pui-owner="Tag"]').filter({ hasText: "US" });
  const leading = await box(country.locator(".pui-tag__leading"));
  const label = await box(country.locator(".pui-tag__label"));
  expect(Math.abs(leading.y + leading.height / 2 - label.y - label.height / 2)).toBeLessThanOrEqual(1);
  const prefixTextWidth = await country.locator(".pui-tag__leading").evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width;
  });
  expect(prefixTextWidth).toBeLessThanOrEqual(leading.width + 1);
  await capture(preview, "tag-prefix");
  preview = await previewFor(page, "tag", "长内容");
  const tag = preview.locator('[data-pui-owner="Tag"]').first();
  const tagBox = await box(tag);
  expect(tagBox.width).toBeLessThanOrEqual(321);
  await expect(tag.locator('[tabindex="0"]').first()).toBeVisible();
  await capture(preview, "tag-long");
});

test("pagination uses equal control heights before and after its container switches mode", async ({ page }) => {
  const preview = await previewFor(page, "pagination", "默认");
  const owner = preview.locator('[data-pui-owner="Pagination"]');
  for (const width of [900, 280]) {
    await resizeHost(preview, width);
    const select = await box(owner.getByRole("combobox"));
    expect(select.height).toBe(36);
    for (const control of await owner.locator("button:visible").all()) {
      expect(Math.abs((await box(control)).height - select.height)).toBeLessThanOrEqual(1);
    }
    if (width < 600) await expect(owner.locator(".pui-pagination__pages")).toBeHidden();
    await noDocumentOverflow(page);
    await capture(preview, `pagination-${width}`);
  }
});

test("inline feedback aligns to the first text line and ordinary banners keep rounded boundaries", async ({ page }) => {
  let preview = await previewFor(page, "banner", "默认");
  await expect(preview.locator(".pui-banner > .pui-alert")).toHaveCSS("border-top-left-radius", "8px");
  await capture(preview, "banner-rounded");
  for (const state of ["默认", "长内容"]) {
    preview = await previewFor(page, "inline-message", state);
    const message = preview.locator('[data-pui-owner="InlineMessage"]');
    const icon = await box(message.locator(":scope > svg"));
    const text = await box(message.locator(":scope > span"));
    expect(Math.abs(icon.y + icon.height / 2 - text.y - 10)).toBeLessThanOrEqual(1);
    if (state === "长内容") expect(text.height).toBeGreaterThan(40);
    await capture(preview, `inline-${state}`);
  }
});

test("single-image lightboxes center media and bound full captions at desktop and 320px", async ({ page }) => {
  const preview = await previewFor(page, "lightbox", "长内容");
  const trigger = preview.getByRole("button", { name: "预览长说明图片", exact: true });
  await trigger.click();
  const dialog = page.locator('[data-pui-owner="Lightbox"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-single", "true");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const image = dialog.locator("figure > img");
    await expect(image).toBeVisible();
    expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(960);
    const imageBox = await box(image);
    expect(imageBox.width).toBeGreaterThan(width === 320 ? 240 : 500);
    expect(imageBox.height).toBeGreaterThan(150);
    expect(Math.abs(imageBox.x + imageBox.width / 2 - width / 2)).toBeLessThanOrEqual(2);
    await expect(dialog.locator(".pui-lightbox__previous,.pui-lightbox__next")).toHaveCount(0);
    const caption = dialog.locator(".pui-lightbox__caption");
    await expect(caption).toContainText("完整说明不会被截断");
    if (width === 320) {
      expect(await caption.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
      await caption.focus();
      await expect(caption).toBeFocused();
      await page.keyboard.press("End");
    }
    await noDocumentOverflow(page);
    await capture(dialog, `lightbox-single-${width}`);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("multi-image preview preserves navigation and focus-trap examples align actions at the right", async ({ page }) => {
  let preview = await previewFor(page, "lightbox", "默认");
  await preview.getByRole("button", { name: "预览图片", exact: true }).click();
  const viewer = page.locator('[data-pui-owner="Lightbox"]');
  await expect(viewer.locator(".pui-lightbox__previous")).toBeVisible();
  await expect(viewer.locator(".pui-lightbox__next")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".pui-lightbox__position")).toHaveText("2 / 2");
  await capture(viewer, "lightbox-multi");
  await page.keyboard.press("Escape");
  preview = await previewFor(page, "focus-trap", "键盘操作");
  await preview.getByRole("button", { name: "在弹窗中查看此状态", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const next = dialog.getByRole("button", { name: "下一步", exact: true });
  const previous = dialog.getByRole("button", { name: "上一步", exact: true });
  const row = dialog.locator('[data-pui-owner="Inline"]');
  const rowBox = await box(row);
  const nextBox = await box(next);
  expect(Math.abs(nextBox.x + nextBox.width - rowBox.x - rowBox.width)).toBeLessThanOrEqual(1);
  await next.focus();
  await page.keyboard.press("Tab");
  await expect(previous).toBeFocused();
  await capture(dialog, "focus-trap-actions");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("field required notes preserve their intended spacing and toolbar long content can shrink", async ({ page }) => {
  let preview = await previewFor(page, "form", "默认");
  await resizeHost(preview, 280);
  const field = preview.locator('[data-pui-owner="Field"]');
  const label = field.locator(".pui-label");
  const input = field.locator("input");
  const a = await box(label);
  const b = await box(input);
  expect(Math.abs(b.y - a.y - a.height - 7)).toBeLessThanOrEqual(1);
  await expect(field.locator(".pui-label__required")).toHaveCSS("white-space", "nowrap");
  await capture(preview, "field-required");
  preview = await previewFor(page, "toolbar", "长内容");
  await resizeHost(preview, 280);
  const toolbar = preview.locator('[data-pui-owner="Toolbar"]');
  expect(await toolbar.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  await noDocumentOverflow(page);
  await capture(preview, "toolbar-narrow");
});
