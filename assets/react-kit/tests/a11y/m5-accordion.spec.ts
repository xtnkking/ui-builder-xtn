import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("accordion disclosure states have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-accordion.html");
  const disclosure = page.getByRole("region", { name: "Uncontrolled disclosure" });
  await disclosure.getByRole("button", { name: "Security", exact: true }).click();
  await disclosure.getByRole("button", { name: "Remove security" }).click();
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
});
