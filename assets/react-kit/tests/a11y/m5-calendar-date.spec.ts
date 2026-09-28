import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("calendar grid and native date fields have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-calendar.html");
  await expect(page.getByRole("grid", { name: /Booking date/ })).toBeVisible();
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
});
