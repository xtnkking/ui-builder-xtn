// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Tree","TreeSelect"]}
import { expect, test } from "@playwright/test";

test("Tree has one roving Tab stop and visible enabled navigation", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree.html");
  const tree = page.getByRole("tree", { name: "Account tree" });
  await page.getByRole("button", { name: "Before tree" }).focus();
  await page.keyboard.press("Tab");
  const account = tree.getByRole("treeitem", { name: "Account" });
  await expect(account).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(account).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tree.getByRole("treeitem", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Remove settings" }).click();
  await expect(tree.getByRole("treeitem", { name: "Profile" })).toHaveAttribute("tabindex", "0");
  await tree.getByRole("treeitem", { name: "Profile" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Remove settings" })).toBeFocused();
});

test("TreeSelect keyboard selection skips disabled and returns to trigger", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree.html");
  const trigger = page.getByRole("combobox", { name: "Section" });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const tree = page.getByRole("tree", { name: "Section" });
  await expect(tree.getByRole("treeitem", { name: "Account" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem", { name: "Settings" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(tree).toHaveCount(0);
  expect(await page.getByRole("form", { name: "Section form" }).evaluate((form) => new FormData(form as HTMLFormElement).get("section"))).toBe("profile");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "After tree select" })).toBeFocused();
});

test("TreeSelect pointer selection of a child does not bubble into the parent selection", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-tree.html");
  const trigger = page.getByRole("combobox", { name: "Section" });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const tree = page.getByRole("tree", { name: "Section" });
  await page.keyboard.press("ArrowRight");
  await tree.getByRole("treeitem", { name: "Profile" }).click();
  await expect(tree).toHaveCount(0);
  await expect(trigger).toContainText("Profile");
  await expect(trigger).toBeFocused();
  expect(await page.getByRole("form", { name: "Section form" }).evaluate((form) => new FormData(form as HTMLFormElement).get("section"))).toBe("profile");
});
