// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["VirtualList"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("VirtualList keeps a bounded DOM, clamps a shortened dataset, and requests each tail once", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-virtual-list.html");
  const list = page.getByRole("list", { name: "Records" });
  await expect(list).toHaveAttribute("tabindex", "0");
  expect(await list.getByRole("listitem").count()).toBeLessThan(12);
  await list.focus();
  await page.keyboard.press("End");
  await expect(list.getByRole("listitem").last()).toContainText("Row 100");
  await expect.poll(() => page.evaluate(() => window.virtualListEndCalls)).toBe(1);
  await list.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
  await list.evaluate((element) => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
  await expect.poll(() => page.evaluate(() => window.virtualListEndCalls)).toBe(1);

  await page.getByRole("button", { name: "Shrink data" }).click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText("Row 1");
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.virtualListEndCalls)).toBe(2);

  await page.getByRole("button", { name: "Append data" }).click();
  await expect(list).toHaveAttribute("tabindex", "0");
  await page.getByRole("button", { name: "Resize viewport" }).click();
  await list.focus();
  await page.keyboard.press("End");
  await expect(list.getByRole("listitem").last()).toContainText("Row 8");
  await expect.poll(() => page.evaluate(() => window.virtualListEndCalls)).toBe(3);
});

test("VirtualList scroll container has no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-virtual-list.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("VirtualList retains a focus target when a focused row leaves the mounted range", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-virtual-list.html");
  const list = page.getByRole("list", { name: "Records" });
  await list.getByRole("button", { name: "Row 1" }).focus();
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(list).toBeFocused();
  await expect(list.getByRole("button", { name: "Row 1", exact: true })).toHaveCount(0);

  await list.getByRole("button", { name: "Row 100" }).focus();
  await page.getByRole("button", { name: "Shrink data" }).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(list).toBeFocused();
  await expect(list).toHaveAttribute("tabindex", "-1");
});
