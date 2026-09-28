// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["SortableList"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("SortableList keyboard and pointer reorders announce contextual positions", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-sortable-list.html");
  const list = page.getByRole("list", { name: "Priority" });
  const down = list.getByRole("button", { name: "下移 Alpha，当前第 1 项，共 3 项" });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("listitem").first()).toContainText("Beta");
  await expect(page.getByRole("status")).toHaveText("Alpha 已移动到第 2 项");
  await list.getByRole("listitem").first().dragTo(list.getByRole("listitem").last());
  await expect(list.getByRole("listitem").last()).toContainText("Beta");
  await expect(page.getByRole("status")).toHaveText("Beta 已移动到第 3 项");
});

test("SortableList controls have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-sortable-list.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
