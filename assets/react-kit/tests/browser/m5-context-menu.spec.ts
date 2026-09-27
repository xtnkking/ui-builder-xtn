// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["ContextMenu"]}
import { expect, test } from "@playwright/test";

test("ContextMenu keyboard opening, roving focus, typeahead, action, and Tab", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-context-menu.html");
  const staticTrigger = page.locator("[data-pui-owner='ContextMenu']").filter({ hasText: "Static record" });
  await expect(staticTrigger).toHaveAttribute("tabindex", "0");
  await staticTrigger.focus();
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: "Record actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Alpha" })).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: "Blocked" })).toBeDisabled();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Bravo" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("menuitem", { name: "Charlie" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(menu.getByRole("menuitem", { name: "Alpha" })).toBeFocused();
  await page.keyboard.press("c");
  await expect(menu.getByRole("menuitem", { name: "Charlie" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Selected action" })).toHaveText("Charlie");
  await expect(staticTrigger).toBeFocused();

  const buttonTrigger = page.getByRole("button", { name: "Button record" });
  await expect(buttonTrigger.locator("..")).toHaveAttribute("tabindex", "-1");
  await buttonTrigger.focus();
  await page.keyboard.press("ContextMenu");
  const buttonMenu = page.getByRole("menu", { name: "Button actions" });
  await expect(buttonMenu.getByRole("menuitem", { name: "Alpha" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(buttonMenu.getByRole("menuitem", { name: "Charlie" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(buttonMenu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "After" })).toBeFocused();
});

test("ContextMenu right click clamps to viewport and outside pointer dismisses", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 360 });
  await page.goto("/tests/fixtures/m5-context-menu.html");
  const edge = page.getByRole("button", { name: "Edge record" });
  await edge.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Edge actions" });
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(11);
  expect(bounds!.y).toBeGreaterThanOrEqual(11);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(309);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(349);
  await expect(menu.getByRole("menuitem", { name: "Blocked" })).toBeDisabled();
  await page.getByRole("button", { name: "After" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edge record" })).not.toBeFocused();
});

test("primary click on the original trigger closes the menu without swallowing the button or modal focus", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-context-menu.html");
  const button = page.getByRole("button", { name: "Button record" });
  await button.focus();
  await page.keyboard.press("ContextMenu");
  const menu = page.getByRole("menu", { name: "Button actions" });
  await expect(menu).toBeVisible();
  await button.click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Button clicks" })).toHaveText("1");
  await expect(button).toBeFocused();

  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Records dialog" });
  const dialogButton = dialog.getByRole("button", { name: "Dialog record" });
  await dialogButton.focus();
  await page.keyboard.press("ContextMenu");
  const dialogMenu = page.getByRole("menu", { name: "Dialog actions" });
  await expect(dialogMenu).toBeVisible();
  await dialogButton.click();
  await expect(dialogMenu).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialogButton).toBeFocused();
});

test("ContextMenu inside Dialog consumes Escape before the parent and yields to nested modal", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-context-menu.html");
  const opener = page.getByRole("button", { name: "Open dialog" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Records dialog" });
  const dialogPanel = page.locator("[data-pui-owner='Dialog']").first();
  const trigger = dialog.getByRole("button", { name: "Dialog record" });
  await trigger.focus();
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: "Dialog actions" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Open confirmation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ContextMenu");
  await expect(menu).toBeVisible();
  await page.keyboard.press(" ");
  const confirm = page.getByRole("dialog", { name: "Confirm action" });
  await expect(confirm).toBeVisible();
  await expect(dialogPanel).toHaveAttribute("inert", "");
  await expect(confirm.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
