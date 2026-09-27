import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Cascader level selection and invalid path have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-cascader.html");
  await page.getByRole("button", { name: "Toggle Tokyo availability" }).click();
  await page.getByRole("form", { name: "Path destination" }).getByRole("combobox", { name: /^Path city/ }).click();
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
});
