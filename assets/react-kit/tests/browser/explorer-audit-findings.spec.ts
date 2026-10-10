// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Cascader","DateField","DateRangeField","InfiniteScroll"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

async function selectState(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name, exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

async function requiredBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("keeps disabled Cascader Select chevrons inside and vertically centered in overview and dark previews", async ({ page }) => {
  await page.goto("/#/components/cascader");

  for (const state of ["总览", "深色模式"]) {
    await test.step(state, async () => {
      const panel = await selectState(page, state);
      const cascader = panel.locator('[data-pui-owner="Cascader"][aria-label="禁用区域"]');
      const selects = cascader.locator("button.pui-select:disabled");
      await expect(selects).toHaveCount(2);

      for (let index = 0; index < 2; index += 1) {
        const select = selects.nth(index);
        const chevron = select.locator(":scope > .pui-select__indicator > svg");
        const selectBox = await requiredBox(select);
        const chevronBox = await requiredBox(chevron);
        expect(chevronBox.x).toBeGreaterThanOrEqual(selectBox.x);
        expect(chevronBox.x + chevronBox.width).toBeLessThanOrEqual(selectBox.x + selectBox.width);
        const selectCenter = selectBox.y + selectBox.height / 2;
        const chevronCenter = chevronBox.y + chevronBox.height / 2;
        expect(Math.abs(chevronCenter - selectCenter)).toBeLessThanOrEqual(1);
      }
    });
  }
});

test("stacks a DateRangeField in the desktop narrow grid and reserves calendar adornment for year precision", async ({ page }) => {
  await page.goto("/#/components/date-time");
  const panel = await selectState(page, "总览");
  const preview = panel.locator(".demo-explorer-preview");
  const range = preview.locator('[data-pui-owner="DateRangeField"]');
  const rangeBox = await requiredBox(range);
  expect(rangeBox.width).toBeLessThanOrEqual(480);

  const dateInputs = range.locator('input[type="date"]');
  await expect(dateInputs).toHaveCount(2);
  await expect(dateInputs.nth(0)).toHaveValue("2026-09-22");
  await expect(dateInputs.nth(1)).toHaveValue("2026-09-30");
  const startBox = await requiredBox(dateInputs.nth(0));
  const endBox = await requiredBox(dateInputs.nth(1));
  expect(Math.abs(startBox.x - endBox.x)).toBeLessThanOrEqual(1);
  expect(endBox.y).toBeGreaterThanOrEqual(startBox.y + startBox.height + 6);
  expect(startBox.width).toBeGreaterThanOrEqual(200);
  expect(endBox.width).toBeGreaterThanOrEqual(200);
  expect(startBox.width).toBeGreaterThanOrEqual(rangeBox.width - 1);
  expect(endBox.width).toBeGreaterThanOrEqual(rangeBox.width - 1);
  await expect(range.locator(":scope > .pui-date-range__separator")).toHaveCSS("display", "none");

  const nativeDateInputs = preview.locator('input[type="month"], input[type="date"], input[type="datetime-local"], input[type="time"]');
  expect(await nativeDateInputs.count()).toBeGreaterThan(0);
  for (const input of await nativeDateInputs.all()) {
    expect(await input.evaluate((element) => element.closest(".pui-input-shell") === null)).toBe(true);
  }

  const year = preview.locator("#explorer-year");
  await expect(year).toHaveAttribute("type", "number");
  const yearShell = preview.locator(".pui-input-shell:has(#explorer-year)");
  await expect(yearShell).toHaveCount(1);
  await expect(yearShell.locator(":scope > .pui-input-shell__start > svg")).toHaveCount(1);
});

test("renders one visible InfiniteScroll loading spinner while preserving live sentinel semantics", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined });
  });
  await page.goto("/#/components/infinite-scroll");

  const loadingPanel = await selectState(page, "加载中");
  const loadingOwner = loadingPanel.locator('[data-pui-owner="InfiniteScroll"]');
  const loadingSentinel = loadingOwner.locator(":scope > .pui-infinite-scroll__sentinel");
  await expect(loadingOwner.locator(".pui-spinner")).toHaveCount(1);
  await expect(loadingOwner.locator(":scope > .pui-load-more .pui-spinner")).toHaveCount(1);
  await expect(loadingSentinel.locator(".pui-spinner")).toHaveCount(0);
  await expect(loadingSentinel).toHaveAttribute("aria-live", "polite");
  await expect(loadingSentinel.locator(":scope > .pui-sr-only")).toContainText(/加载/);

  const darkPanel = await selectState(page, "深色模式");
  const manualOwner = darkPanel.locator('[data-pui-owner="InfiniteScroll"]');
  await expect(manualOwner.locator(":scope > .pui-load-more")).toHaveCount(0);
  await darkPanel.getByRole("button", { name: "手动加载下一页", exact: true }).click();
  await expect.poll(() => manualOwner.evaluate((element) => {
    const sentinel = element.querySelector<HTMLElement>(":scope > .pui-infinite-scroll__sentinel");
    return {
      live: sentinel?.getAttribute("aria-live"),
      spinnerCount: sentinel?.querySelectorAll(".pui-spinner").length ?? 0,
      srOnlyCount: sentinel?.querySelectorAll(".pui-sr-only").length ?? 0,
      hasLoadingText: Boolean(sentinel?.textContent?.includes("加载")),
    };
  })).toEqual({ live: "polite", spinnerCount: 1, srOnlyCount: 0, hasLoadingText: true });
});
