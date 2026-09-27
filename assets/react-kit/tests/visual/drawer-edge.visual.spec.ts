// @personal-ui-coverage {"kind":"browser","runner":"visual","exports":["Drawer"]}
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("default desktop Drawer keeps its flush edge geometry and left corner treatment", async ({ page }) => {
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "用户权限表格预览" }).click();
  await page.getByRole("button", { name: "编辑陈沐" }).click();

  const drawer = page.getByRole("dialog", { name: "编辑陈沐的权限" });
  await expect(drawer).toBeVisible();

  const viewport = page.viewportSize();
  const box = await drawer.boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if (!viewport || !box) return;

  expect(box.y).toBe(0);
  expect(box.x + box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);
  await expect(drawer).toHaveCSS("border-radius", "16px 0px 0px 16px");

  const cornerClip = {
    x: Math.round(box.x) - 8,
    width: 28,
    height: 28,
  };

  await expect(page).toHaveScreenshot("drawer-edge-top-left.png", {
    clip: { ...cornerClip, y: 0 },
    maxDiffPixels: 0,
  });
  await expect(page).toHaveScreenshot("drawer-edge-bottom-left.png", {
    clip: { ...cornerClip, y: viewport.height - cornerClip.height },
    maxDiffPixels: 0,
  });
});
