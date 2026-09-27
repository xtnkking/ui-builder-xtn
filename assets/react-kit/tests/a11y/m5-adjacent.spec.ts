import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("agenda, separator, infinite list, Transfer, and command dialog have no serious axe findings", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const base = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(base.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
  await page.getByRole("button", { name: "Open commands" }).click();
  await expect(page.getByRole("dialog", { name: "Commands" })).toBeVisible();
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
});
