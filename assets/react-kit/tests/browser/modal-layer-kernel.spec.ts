// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["ConfirmDialog","Dialog","Drawer"]}
import { expect, test } from "@playwright/test";
import { legacyExplorerCaseTabs, selectExplorerCase } from "../../../../scripts/browser-explorer-case.mjs";

test("keeps nested modal focus, dismissal, inert, and scroll state coherent", async ({ page }) => {
  await page.goto("/#/components/dialog");

  const dialogCase = await selectExplorerCase(page, legacyExplorerCaseTabs.dialog);
  const opener = dialogCase.getByRole("button", { name: "分配角色" });
  await opener.click();
  const dialog = page.locator("[data-pui-owner='Dialog']").filter({ hasText: "分配角色 · xtn" }).first();
  await expect(dialog).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const nestedOpener = dialog.getByRole("button", { name: "上层确认" });
  await nestedOpener.click();
  const confirm = page.getByRole("dialog", { name: "确认国家范围" });
  await expect(confirm).toBeVisible();
  await expect(dialog).toHaveAttribute("inert", "");
  await expect(dialog).toHaveAttribute("aria-hidden", "true");
  await expect(confirm.getByRole("button", { name: "取消" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("inert", "");
  await expect(nestedOpener).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

  await opener.click();
  await expect(dialog).toBeVisible();
  await dialog.evaluate((panel) => {
    panel.parentElement?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭对话框" }).click();
  await expect(dialog).toBeHidden();
});

test("keeps Drawer modal state and focus restoration aligned with Dialog", async ({ page }) => {
  await page.goto("/#/components/data-table");

  const dataTableCase = await selectExplorerCase(page, legacyExplorerCaseTabs.dataTable);
  const opener = dataTableCase.getByRole("button", { name: "编辑陈沐" });
  await opener.click();
  const drawer = page.getByRole("dialog", { name: "编辑陈沐的权限" });
  await expect(drawer).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  const close = drawer.getByRole("button", { name: "关闭抽屉" });
  await close.focus();
  await page.keyboard.press("Tab");
  await expect(drawer.getByLabel("角色")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
});
