import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("tree and open tree select have valid accessible structures", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree.html");
  await page.getByRole("combobox", { name: "Section" }).click();
  await expect(page.getByRole("tree", { name: "Section" })).toBeVisible();
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({ id: v.id, targets: v.nodes.map((node) => node.target) }))).toEqual([]);
});
