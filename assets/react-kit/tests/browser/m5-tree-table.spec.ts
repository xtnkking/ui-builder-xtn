// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["TreeTable"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("TreeTable is a semantic table with keyboard disclosure and visible async retry", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree-table.html");
  const table = page.getByRole("table", { name: "Teams" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("treegrid")).toHaveCount(0);
  const expand = table.getByRole("button", { name: "展开 Team" });
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(table.getByRole("alert")).toHaveText("加载失败，请重试");
  const retry = table.getByRole("button", { name: "重试加载 Team" });
  await expect(retry).toBeFocused();
  await page.keyboard.press("Space");
  await expect(table.getByRole("row", { name: "Member" })).toBeVisible();
  const collapse = table.getByRole("button", { name: "折叠 Team" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await collapse.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "After table" })).toBeFocused();
});

test("TreeTable disclosure has no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree-table.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
