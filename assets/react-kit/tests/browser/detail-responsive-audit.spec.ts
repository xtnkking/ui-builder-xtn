// Targeted regressions for confirmed findings from the 2026-10-12 detail audit.
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page, family: string, state = "默认") {
  await page.goto(`/#/components/${family}`);
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}
async function box(node: Locator) {
  await expect(node).toBeVisible();
  const value = await node.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}
async function capture(node: Locator, name: string) {
  await node.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test("long search is editable and clearable; Select disabled state is actually disabled", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const preview = await previewFor(page, "search-input", "长内容");
  const input = preview.getByRole("searchbox", { name: "长搜索条件", exact: true });
  await expect(input).toBeEditable();
  await input.fill("更新后的搜索");
  await preview.getByRole("button", { name: "清除搜索", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await noOverflow(page);
  const disabled = await previewFor(page, "select", "禁用 · Select");
  await expect(disabled.getByRole("combobox", { name: /^禁用角色/ })).toBeDisabled();
});

test("long selector options wrap fully at 320px with stable selection slots", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const preview = await previewFor(page, "select", "长内容");
  for (const label of ["长选项", "可搜索长选项"]) {
    const trigger = preview.getByRole("combobox", { name: new RegExp(`^${label}`) });
    await trigger.click();
    const list = page.getByRole("listbox", { name: label, exact: true });
    const option = list.getByRole("option").first();
    const copy = option.locator(label === "长选项" ? ".ui-select__option-label" : ".ui-option__copy strong");
    await expect(copy).toContainText("enterprise security operations");
    const metrics = await copy.evaluate(node => ({
      whiteSpace: getComputedStyle(node).whiteSpace,
      horizontalClip: node.scrollWidth - node.clientWidth,
      verticalClip: node.scrollHeight - node.clientHeight,
    }));
    expect(metrics).toEqual({ whiteSpace: "normal", horizontalClip: 0, verticalClip: 0 });
    const size = await box(option);
    expect(size.height).toBeGreaterThanOrEqual(44);
    const bounds = await box(list);
    expect(bounds.x).toBeGreaterThanOrEqual(11);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(309);
    await capture(list, label === "长选项" ? "select-full-option-320" : "searchable-full-option-320");
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
  }
  await noOverflow(page);
});

test("FilterBar aligns actual controls despite multiline labels and hints and reflows in a narrow host", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const preview = await previewFor(page, "filter-bar", "总览");
  const form = preview.getByRole("form", { name: "带提示的成员筛选", exact: true });
  const input = form.getByRole("searchbox", { name: "成员姓名", exact: true });
  const select = form.getByRole("combobox", { name: /^认证状态/ });
  const action = form.getByRole("button", { name: "应用筛选", exact: true });
  await expect.poll(async () => Math.abs((await box(input.locator(".."))).y - (await box(select)).y)).toBeLessThanOrEqual(1);
  await expect.poll(async () => Math.abs((await box(action)).y - (await box(select)).y)).toBeLessThanOrEqual(1);
  await input.fill("lin");
  await input.press("Enter");
  await expect(form.getByRole("status")).toContainText("lin");
  await capture(form, "field-hints-aligned-desktop");
  // Resize only the surrounding demo host, without overriding protected controls.
  await preview.evaluate(node => { node.style.width = "320px"; node.style.maxWidth = "100%"; });
  await expect.poll(async () => Number.parseFloat(await action.locator("..").evaluate(node => getComputedStyle(node).marginTop))).toBe(0);
  const control = await box(select);
  expect((await box(action)).y).toBeGreaterThanOrEqual(control.y + control.height);
  await capture(form, "field-hints-narrow-host");
  await page.setViewportSize({ width: 320, height: 1100 });
  await noOverflow(page);
  expect((await box(action)).height).toBe(44);
});

test("table query Enter preserves the page and applies the same explicit draft as click", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page, "data-table");
  const filter = preview.getByRole("form", { name: "账户筛选", exact: true });
  const table = preview.locator('[data-ui-owner="DataTable"]');
  await table.getByRole("button", { name: "下一页", exact: true }).click();
  const input = filter.getByRole("searchbox", { name: "账户、负责人或状态", exact: true });
  const previousText = await table.innerText();
  const beforeUrl = page.url();
  await page.evaluate(() => { (window as unknown as { detailAuditMarker: string }).detailAuditMarker = "preserve"; });
  await input.fill("林晓");
  await expect.poll(() => table.innerText()).toBe(previousText);
  await input.press("Enter");
  await expect(table).toContainText("亚太区结算主账户");
  await expect(table).not.toContainText("北美订阅服务账户");
  expect(page.url()).toBe(beforeUrl);
  expect(await page.evaluate(() => (window as unknown as { detailAuditMarker: string }).detailAuditMarker)).toBe("preserve");
  await input.fill("王宁");
  await filter.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(table).toContainText("北美订阅服务账户");
  await expect(table).not.toContainText("亚太区结算主账户");
});

test("pagination recalculates page count and preserves a visible compact page loading indicator", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page, "pagination");
  const nav = preview.getByRole("navigation", { name: "数据分页", exact: true });
  await nav.getByRole("combobox", { name: /^每页数量/ }).click();
  await page.getByRole("option", { name: /^50\s/ }).click();
  await expect(nav.getByRole("button", { name: "第 5 页", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "第 12 页", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 1000 });
  const loading = await previewFor(page, "pagination", "加载中");
  const pagers = loading.getByRole("navigation", { name: "数据分页", exact: true });
  await expect(pagers.nth(0).locator(".ui-pagination__mobile-loading .ui-spinner")).toBeVisible();
  await expect(pagers.nth(1).locator(".ui-pagination__mobile-loading .ui-spinner")).toHaveCount(0);
  await capture(loading, "pagination-loading-320");
  await noOverflow(page);
});

test("long Tabs labels ellipsize without losing keyboard access or full accessible names", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const preview = await previewFor(page, "tabs", "长内容");
  const tabs = preview.getByRole("tablist", { name: "长标题", exact: true });
  const longLabel = "跨区域基础设施迁移项目的全部成员权限与安全策略审核记录";
  const longTab = tabs.getByRole("tab", { name: longLabel, exact: true });
  const copy = longTab.locator(".ui-tabs__label");
  await expect(copy).toHaveAttribute("title", longLabel);
  const metrics = await copy.evaluate(node => ({ clipped: node.scrollWidth > node.clientWidth, ellipsis: getComputedStyle(node).textOverflow }));
  expect(metrics).toEqual({ clipped: true, ellipsis: "ellipsis" });
  expect((await box(longTab)).width).toBeLessThanOrEqual((await box(tabs)).width);
  await longTab.focus();
  await longTab.press("ArrowRight");
  const shortTab = tabs.getByRole("tab", { name: "概览", exact: true });
  await expect(shortTab).toBeFocused();
  await expect(shortTab).toHaveAttribute("aria-selected", "true");
  await capture(preview, "tabs-long-320");
  await noOverflow(page);
});

test("Dialog owns paragraph spacing without stacking browser margins on its gap", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const preview = await previewFor(page, "dialog", "长内容");
  await preview.getByRole("button", { name: "长内容弹窗", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "项目配置详情", exact: true });
  const paragraphs = dialog.locator(".ui-dialog__body > p");
  const spacing = await paragraphs.evaluateAll(nodes => {
    const first = nodes[0].getBoundingClientRect();
    const second = nodes[1].getBoundingClientRect();
    const style = getComputedStyle(nodes[0]);
    return { gap: second.top - first.bottom, marginTop: style.marginTop, marginBottom: style.marginBottom };
  });
  expect(spacing).toEqual({ gap: 16, marginTop: "0px", marginBottom: "0px" });
  await expect(dialog.getByRole("button", { name: "完成查看", exact: true })).toBeVisible();
  await capture(dialog, "dialog-paragraphs-320");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
