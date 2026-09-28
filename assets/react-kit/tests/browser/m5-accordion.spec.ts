// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Accordion"]}
import { expect, test } from "@playwright/test";

test("accordion keyboard traversal skips hidden and disabled content", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-accordion.html");
  const disclosure = page.getByRole("region", { name: "Uncontrolled disclosure" });
  const profile = disclosure.getByRole("button", { name: "Profile", exact: true });
  const security = disclosure.getByRole("button", { name: "Security", exact: true });
  const profilePanel = disclosure.locator(".pui-collapse__panel").first();
  const securityPanel = disclosure.locator(".pui-collapse__panel").nth(1);

  await page.getByRole("button", { name: "Before accordion" }).focus();
  await page.keyboard.press("Tab");
  await expect(profile).toBeFocused();
  await expect(profile).toHaveAttribute("aria-expanded", "true");
  await expect(profilePanel).not.toHaveAttribute("hidden", "");
  await expect(securityPanel).toHaveAttribute("hidden", "");
  await page.keyboard.press("Tab");
  await expect(disclosure.getByRole("button", { name: "Profile action" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(security).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(security).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(disclosure.getByRole("button", { name: "Security action" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(disclosure.getByRole("button", { name: "Remove security" })).toBeFocused();

  await profile.click();
  await expect(profilePanel).toHaveAttribute("hidden", "");
  await expect(disclosure.getByRole("button", { name: "Profile action" })).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(security).toBeFocused();
});

test("removal prunes uncontrolled state without changing controlled ownership", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-accordion.html");
  const uncontrolled = page.getByRole("region", { name: "Uncontrolled disclosure" });
  const controlled = page.getByRole("region", { name: "Controlled disclosure", exact: true });

  await uncontrolled.getByRole("button", { name: "Security", exact: true }).click();
  await expect(uncontrolled.getByTestId("open-ids")).toHaveText("profile,security");
  await uncontrolled.getByRole("button", { name: "Remove security" }).click();
  await expect(uncontrolled.getByTestId("open-ids")).toHaveText("profile");
  await uncontrolled.getByRole("button", { name: "Restore security" }).click();
  await expect(uncontrolled.getByRole("button", { name: "Security", exact: true })).toHaveAttribute("aria-expanded", "false");

  await controlled.getByRole("button", { name: "Remove controlled profile" }).click();
  await expect(controlled.getByTestId("controlled-open-ids")).toHaveText("profile");
  await controlled.getByRole("button", { name: "Security", exact: true }).click();
  await expect(controlled.getByTestId("controlled-open-ids")).toHaveText("security");
  await controlled.getByRole("button", { name: "Restore controlled profile" }).click();
  await expect(controlled.getByRole("button", { name: "Security", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(controlled.getByRole("button", { name: "Profile", exact: true })).toHaveAttribute("aria-expanded", "false");
});
