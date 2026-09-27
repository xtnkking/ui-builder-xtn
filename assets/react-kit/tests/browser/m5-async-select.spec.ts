// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["AsyncSelect"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("AsyncSelect keeps stable active options and rejects stale remote results", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-async-select.html");
  const trigger = page.getByRole("combobox", { name: "国家", exact: true });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "搜索国家" });
  const listbox = page.getByRole("listbox", { name: "国家" });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-controls", await listbox.getAttribute("id") ?? "");

  await input.fill("slow");
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("slow"))).toBe(true);
  await input.fill("fast");
  await expect.poll(() => page.evaluate(() => Boolean((window as any).asyncSelectFixture.aborted("slow")))).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("fast"))).toBe(true);
  await page.evaluate(() => (window as any).asyncSelectFixture.resolve("fast"));
  await expect(listbox.getByRole("option")).toHaveCount(2);
  await expect(input).toHaveAttribute("aria-activedescendant", await listbox.getByRole("option", { name: /United States/ }).getAttribute("id") ?? "");
  await input.press("ArrowDown");
  await expect(input).toBeFocused();
  await expect(listbox.getByRole("option", { name: "Unavailable" })).not.toHaveAttribute("data-active", "true");
  await input.press("Enter");
  await expect(listbox).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("United States");
  expect(await page.evaluate(() => (window as any).asyncSelectFixture.formValue())).toBe("us");

  await page.evaluate(() => (window as any).asyncSelectFixture.resolve("slow"));
  await trigger.click();
  await expect(page.getByRole("combobox", { name: "搜索国家" })).toBeFocused();
  await expect(listbox.getByRole("option", { name: /United Kingdom/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("AsyncSelect combobox and listbox have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-async-select.html");
  await page.getByRole("combobox", { name: "国家", exact: true }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("AsyncSelect keeps error and retry out of selectable options, then clears and reopens", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-async-select.html");
  const trigger = page.getByRole("combobox", { name: "国家", exact: true });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "搜索国家" });
  await input.fill("fast");
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("fast"))).toBe(true);
  await page.evaluate(() => (window as any).asyncSelectFixture.reject("fast"));
  await expect(page.getByRole("alert")).toContainText("加载失败");
  await expect(page.getByRole("listbox", { name: "国家" }).getByRole("option")).toHaveCount(0);
  await page.getByRole("button", { name: "重试" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("fast"))).toBe(true);
  await page.evaluate(() => (window as any).asyncSelectFixture.resolve("fast"));
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(input).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("United States");
  await trigger.click();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => (window as any).asyncSelectFixture.formValue())).toBe("us");
});

test("AsyncSelect Tab follows portal actions then continues after trigger; Shift+Tab returns to trigger", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-async-select.html");
  const trigger = page.getByRole("combobox", { name: "国家", exact: true });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "搜索国家" });
  await input.press("Tab");
  await expect(page.getByRole("button", { name: "后置操作" })).toBeFocused();
  await expect(page.getByRole("listbox", { name: "国家" })).toHaveCount(0);

  await trigger.click();
  await expect(input).toBeFocused();
  await input.fill("fast");
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("fast"))).toBe(true);
  await page.evaluate(() => (window as any).asyncSelectFixture.resolve("fast"));
  await expect(page.getByRole("listbox", { name: "国家" }).getByRole("option")).toHaveCount(2);

  await input.press("Tab");
  const clear = page.getByRole("button", { name: "清除搜索" });
  await expect(clear).toBeFocused();
  await clear.press("Tab");
  await expect(page.getByRole("button", { name: "后置操作" })).toBeFocused();
  await expect(page.getByRole("listbox", { name: "国家" })).toHaveCount(0);

  await trigger.click();
  await expect(input).toBeFocused();
  await input.press("Shift+Tab");
  await expect(trigger).toBeFocused();
  await expect(page.getByRole("listbox", { name: "国家" })).toHaveCount(0);
  await trigger.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "前置操作" })).toBeFocused();
});

test("AsyncSelect retry and modal load-more are sequential Tab stops without escaping the Dialog", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-async-select.html");
  await page.getByRole("combobox", { name: "国家", exact: true }).click();
  const input = page.getByRole("combobox", { name: "搜索国家" });
  await input.fill("fast");
  await expect.poll(() => page.evaluate(() => (window as any).asyncSelectFixture.pending("fast"))).toBe(true);
  await page.evaluate(() => (window as any).asyncSelectFixture.reject("fast"));
  await input.press("Tab");
  const clear = page.getByRole("button", { name: "清除搜索" });
  await expect(clear).toBeFocused();
  await clear.press("Tab");
  const retry = page.getByRole("button", { name: "重试" });
  await expect(retry).toBeFocused();
  await retry.press("Shift+Tab");
  await expect(clear).toBeFocused();
  await clear.press("Shift+Tab");
  await expect(input).toBeFocused();
  await input.press("Tab");
  await clear.press("Tab");
  await retry.press("Tab");
  await expect(page.getByRole("button", { name: "后置操作" })).toBeFocused();

  await page.getByRole("button", { name: "打开对话框" }).click();
  const dialog = page.getByRole("dialog", { name: "选择地区" });
  await dialog.getByRole("combobox", { name: "地区", exact: true }).click();
  const dialogSearch = page.getByRole("combobox", { name: "搜索地区" });
  await expect(dialogSearch).toBeFocused();
  await dialogSearch.press("Tab");
  const dialogClear = page.getByRole("button", { name: "清除搜索" });
  await expect(dialogClear).toBeFocused();
  await dialogClear.press("Tab");
  const loadMore = page.getByRole("button", { name: "加载更多" });
  await expect(loadMore).toBeFocused();
  await loadMore.press("Shift+Tab");
  await expect(dialogClear).toBeFocused();
  await dialogClear.press("Tab");
  await expect(loadMore).toBeFocused();
  await loadMore.press("Tab");
  await expect(dialog.getByRole("button", { name: "对话框后置操作" })).toBeFocused();
  await expect(page.getByRole("listbox", { name: "地区" })).toHaveCount(0);
  await dialog.getByRole("combobox", { name: "地区", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "搜索地区" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("combobox", { name: "地区", exact: true })).toBeFocused();
  await expect(page.getByRole("listbox", { name: "地区" })).toHaveCount(0);
});
