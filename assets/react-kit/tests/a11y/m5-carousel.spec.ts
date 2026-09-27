import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Carousel manual, autoplay, and empty states have no blocking axe findings", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixtures/m5-carousel.html");
  const manual = page.getByRole("region", { name: "Manual highlights" });
  await manual.getByRole("button", { name: "显示 Third" }).click();
  await expect(manual.locator(".pui-carousel__stage")).toHaveAttribute("aria-label", "3 / 3: Third");
  const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
});
