import axeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("ContextMenu exposed standalone and inside a modal has no blocking axe findings", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-context-menu.html");
  const scan = async () => {
    const result = await new axeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
  };

  const staticTrigger = page.locator("[data-pui-owner='ContextMenu']").filter({ hasText: "Static record" });
  await staticTrigger.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: "Record actions" })).toBeVisible();
  await scan();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Open dialog" }).click();
  const trigger = page.getByRole("dialog", { name: "Records dialog" }).getByRole("button", { name: "Dialog record" });
  await trigger.focus();
  await page.keyboard.press("ContextMenu");
  await expect(page.getByRole("menu", { name: "Dialog actions" })).toBeVisible();
  await scan();
});
