// @ui-coverage {"kind":"browser","runner":"browser","exports":["AsyncSelect","Autocomplete","Cascader","DateRangeField","Field","GuidedTour","HoverCard","MultiSelect","Popover","Select","Tag","TagInput","ThemeProvider"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function fixture(page: Page, scenario: string, theme = "default") {
  await page.goto(`/tests/fixtures/component-detail.html?case=${scenario}&theme=${theme}`);
  await expect(page.locator("main")).toBeVisible();
}
async function readableOptions(list: Locator, radius: number) {
  const rows = await list.locator(".ui-extra-option").evaluateAll(elements => elements.map(e => {
    const copy = e.querySelector(".ui-extra-option__copy")!;
    const bounds = e.getBoundingClientRect();
    const text = copy.getBoundingClientRect();
    const children = [...e.children].map(child => ({ left: child.getBoundingClientRect().left, right: child.getBoundingClientRect().right }));
    return { radius: getComputedStyle(e).borderRadius, width: text.width, left: text.left, right: text.right, optionRight: bounds.right, children };
  }));
  expect(rows.length).toBeGreaterThanOrEqual(2);
  for (const row of rows) {
    expect(row.width).toBeGreaterThan(100);
    expect(row.right).toBeLessThanOrEqual(row.optionRight);
    expect(row.radius).toBe(`${radius}px`);
    for (let index = 1; index < row.children.length; index++) expect(row.children[index].left).toBeGreaterThanOrEqual(row.children[index - 1].right);
  }
}

test("enhanced options keep text slots readable with mixed leading across themes", async ({ page }, testInfo) => {
  for (const [theme, radius] of [["default", 6], ["apple", 13], ["material", 9]] as const) {
    await fixture(page, "inputs", theme);
    for (const [id, selector] of [["multi", ".ui-multi-select__popover"], ["async", ".ui-async-select__popover"], ["auto", ".ui-autocomplete__list"], ["tag-input", ".ui-tag-input__suggestions"]]) {
      const input = page.locator(`#${id}`).getByRole("combobox");
      await input.click();
      if (id === "auto") await input.press("ArrowDown");
      if (id === "tag-input") await input.fill("工作区");
      const list = page.locator(selector);
      await expect(list).toBeVisible();
      await readableOptions(list, radius);
      if (theme === "apple" && id === "multi") await page.screenshot({ path: testInfo.outputPath("apple-multi-slots.png") });
      await page.keyboard.press("Escape");
      // TagInput closes suggestions on blur; keep its text unchanged while testing the other controls.
      await page.locator("main").click({ position: { x: 350, y: 5 } });
    }
  }
});

test("small removable tags and narrow Cascader retain their sizing and keyboard behavior", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await fixture(page, "sizing");
  for (const [id, height] of [["small-tags", 26], ["medium-tags", 30]] as const) {
    const tags = await page.locator(`#${id} .ui-tag`).evaluateAll(nodes => nodes.map(e => e.getBoundingClientRect().height));
    expect(tags).toEqual([height, height]);
  }
  const remove = page.getByRole("button", { name: "删除小标签", exact: true });
  await expect(remove).toHaveCSS("height", "24px");
  await remove.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#small-tags .ui-tag")).toHaveCount(1);
  const geometry = await page.locator("#cascade").evaluate(host => ({ width: host.clientWidth, scrollWidth: host.scrollWidth, selects: [...host.querySelectorAll(".ui-select")].map(e => e.getBoundingClientRect().width) }));
  expect(geometry.width).toBe(160);expect(geometry.scrollWidth).toBeLessThanOrEqual(160);
  expect(geometry.selects).toHaveLength(2);for (const width of geometry.selects) expect(width).toBeLessThanOrEqual(160);
  await page.locator("#cascade").getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "日本", exact: true }).click();
  await expect(page.locator("#cascade").getByRole("combobox").nth(1)).toContainText("日本");
  await page.screenshot({ path: testInfo.outputPath("tag-cascader-320.png") });
});

test("Popover owns nested Select and MultiSelect portals while preserving dismissal", async ({ page }) => {
  await fixture(page, "popover");
  const parent = page.getByRole("button", { name: "筛选设置", exact: true });
  await parent.click();
  const select = page.getByRole("combobox", { name: /^浮层内区域/ });
  await select.click();await page.getByRole("option", { name: "法国", exact: true }).click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");await expect(select).toContainText("法国");
  await select.click();await page.keyboard.press("Escape");
  await expect(select).toHaveAttribute("aria-expanded", "false");await expect(parent).toHaveAttribute("aria-expanded", "true");
  const multi = page.getByRole("combobox", { name: /^浮层内权限/ });
  await multi.click();await page.getByRole("option", { name: "英国工作区", exact: true }).click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");await expect(parent).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");await expect(parent).toHaveAttribute("aria-expanded", "false");
  await parent.click();await page.getByRole("button", { name: "浮层外操作", exact: true }).click();await expect(parent).toHaveAttribute("aria-expanded", "false");
});

test("HoverCard follows focus through its content and child portal then closes on departure", async ({ page }) => {
  await fixture(page, "hover");
  const trigger = page.getByRole("button", { name: "成员卡片", exact: true });
  const outside = page.getByRole("button", { name: "卡片外操作", exact: true });
  await trigger.focus();
  const first = page.getByRole("button", { name: "卡片内第一操作", exact: true });
  const second = page.getByRole("button", { name: "卡片内第二操作", exact: true });
  await first.focus();await page.keyboard.press("Tab");await expect(second).toBeFocused();await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Shift+Tab");await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");await expect(outside).toBeFocused();await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  const select = page.getByRole("combobox", { name: /^卡片内区域/ });
  await select.click();await page.getByRole("option", { name: "法国工作区", exact: true }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");await expect(trigger).toHaveAttribute("aria-expanded", "false");await expect(trigger).toBeFocused();
});

test("GuidedTour keeps long content scrollable and footer reachable in a short viewport", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 240 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);await fixture(page, "tour");await page.getByRole("button", { name: "打开长引导", exact: true }).click();
    const card = page.locator(".ui-tour__card"), body = card.locator(".ui-tour__body");
    const bounds = await card.boundingBox();expect(bounds).not.toBeNull();expect(bounds!.y).toBeGreaterThanOrEqual(19);expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - 19);
    const scroll = await body.evaluate(e => ({ height: e.clientHeight, scrollHeight: e.scrollHeight, overflow: getComputedStyle(e).overflowY }));
    expect(scroll.height).toBeGreaterThan(0);expect(scroll.scrollHeight).toBeGreaterThan(scroll.height);expect(scroll.overflow).toBe("auto");
    await body.focus();await page.keyboard.press("End");await expect.poll(() => body.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
    const next = page.getByRole("button", { name: "下一步", exact: true });
    await expect(next).toBeInViewport();await next.click();await expect(card.getByRole("heading", { name: "完成配置", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`tour-${viewport.width}.png`) });
    await page.getByRole("button", { name: "完成", exact: true }).click();await expect(card).toHaveCount(0);
  }
});

test("official date validation has a single associated range error", async ({ page }) => {
  await page.goto("/#/components/date-time");await page.getByRole("tab", { name: "校验", exact: true }).click();
  const error = page.getByRole("alert").filter({ hasText: "结束日期不能早于开始日期。" });await expect(error).toHaveCount(1);
  const errorId = await error.getAttribute("id");expect(errorId).toBeTruthy();
  const range = page.locator('[data-ui-owner="DateRangeField"]');
  const inputs = range.locator('input:not([type="hidden"])');await expect(inputs).toHaveCount(2);
  for (const input of await inputs.all()) expect((await input.getAttribute("aria-describedby"))?.split(/\s+/)).toContain(errorId);
});
