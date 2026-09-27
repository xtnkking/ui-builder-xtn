// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["InlineEdit"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("InlineEdit restores keyboard focus across cancel, async failure, success, and reset", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-inline-edit.html");
  const edit = page.getByRole("button", { name: "Edit display name" });
  const input = page.getByRole("textbox", { name: "Edit display name" });

  await edit.focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(edit).toBeFocused();

  await page.keyboard.press("Enter");
  await input.fill("Grace");
  await page.keyboard.press("Enter");
  await expect(input).toHaveAttribute("readonly");
  await page.evaluate(() => window.inlineEditRequest?.reject("服务器繁忙"));
  await expect(page.getByRole("alert")).toHaveText("服务器繁忙");
  await expect(input).toBeFocused();
  await expect(input).not.toHaveAttribute("readonly");

  await page.getByRole("button", { name: "保存" }).click();
  await page.evaluate(() => window.inlineEditRequest?.reject("请重试"));
  await expect(page.getByRole("alert")).toHaveText("请重试");
  await expect(input).toBeFocused();

  await page.keyboard.press("Enter");
  await page.evaluate(() => window.inlineEditRequest?.resolve());
  await expect(edit).toBeFocused();
  await expect(page.getByText("Grace", { exact: true })).toBeVisible();

  await page.keyboard.press("Enter");
  await input.fill("Changed");
  await page.keyboard.press("Enter");
  const reset = page.getByRole("button", { name: "Reset profile" });
  await reset.focus();
  await page.keyboard.press("Enter");
  await expect(edit).toBeVisible();
  await expect(reset).toBeFocused();
  await page.evaluate(() => window.inlineEditRequest?.reject("late failure"));
  await expect(page.getByText("Ada", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("InlineEdit required state and error remain accessible in both modes", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-inline-edit.html");
  const edit = page.getByRole("button", { name: "Edit display name" });
  await expect(edit).not.toHaveAttribute("aria-required");
  const collapsed = await new AxeBuilder({ page }).analyze();
  expect(collapsed.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
  await edit.click();
  await expect(page.getByRole("textbox", { name: "Edit display name" })).toHaveAttribute("aria-required", "true");
  const expanded = await new AxeBuilder({ page }).analyze();
  expect(expanded.violations.filter((item) => ["critical", "serious"].includes(item.impact ?? ""))).toEqual([]);
});
