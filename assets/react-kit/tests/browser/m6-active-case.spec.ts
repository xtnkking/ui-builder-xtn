import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("mounts only the active command case and state, and cleans up shortcut listeners", async ({ page }) => {
  await page.goto("/#/components/command");
  const preview = page.getByRole("tabpanel", { name: "预览", exact: true });
  const overview = preview.getByRole("tabpanel", { name: "总览", exact: true });
  const opener = overview.getByRole("button", { name: "打开命令面板", exact: true });
  const stateTabs = preview.getByRole("tablist", { name: "命令面板与快捷键状态案例", exact: true });
  const palettes = page.locator('[data-pui-owner="CommandPalette"]');
  const dialogs = page.locator('[role="dialog"]');
  const overlays = page.locator(".pui-overlay");

  const expectLayerCount = async (count: 0 | 1) => {
    // Count every mounted layer, including inert lower layers hidden from the accessibility tree.
    await expect(palettes).toHaveCount(count);
    await expect(dialogs).toHaveCount(count);
    await expect(overlays).toHaveCount(count);
  };

  await expect(opener).toBeVisible();
  await expectLayerCount(0);

  await opener.click();
  await expectLayerCount(1);
  await expect(palettes).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palettes).toBeHidden();
  await expectLayerCount(0);
  await expect(opener).toBeFocused();

  await page.keyboard.press("Control+k");
  await expectLayerCount(1);
  await expect(palettes).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palettes).toBeHidden();
  await expectLayerCount(0);
  await expect(opener).toBeFocused();

  for (const state of ["uncontrolled", "loading"] as const) {
    const stateTab = stateTabs.getByRole("tab", { name: `${state} · CommandPalette`, exact: true });
    await stateTab.click();
    await expect(stateTab).toHaveAttribute("aria-selected", "true");
    await expectLayerCount(1);
    await expect(palettes).toBeVisible();
    if (state === "loading") {
      await expect(palettes.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
    } else {
      await expect(palettes.getByRole("option", { name: "创建项目", exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(palettes).toBeHidden();
    await expectLayerCount(0);
    await expect(stateTab).toBeFocused();
  }

  // Leave a state with a real shortcut listener before unmounting the entire preview case.
  await stateTabs.getByRole("tab", { name: "总览", exact: true }).click();
  await expect(opener).toBeVisible();
  await expectLayerCount(0);
  const codeTab = page.getByRole("tab", { name: "代码", exact: true });
  await codeTab.click();
  await expect(page.getByRole("tabpanel", { name: "代码", exact: true })).toBeVisible();
  await expect(page.locator(".demo-explorer-preview")).toHaveCount(0);
  await expectLayerCount(0);
  await page.keyboard.press("Control+k");
  await expectLayerCount(0);
  await expect(codeTab).toBeFocused();
});
