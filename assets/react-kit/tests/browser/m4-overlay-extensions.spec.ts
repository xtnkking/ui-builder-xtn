// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["GuidedTour","HoverCard","Lightbox","Popconfirm","Popover"]}
import { expect, test } from "@playwright/test";

test("M4 overlay extensions preserve keyboard, target, focus, and trigger contracts", async ({ page }) => {
  await page.goto("/tests/fixtures/m4-overlays.html");

  await expect(page.getByRole("button", { name: "说明弹层" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "资料预览" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "删除记录确认" })).toHaveCount(1);
  await expect(page.locator("button button")).toHaveCount(0);
  await page.getByRole("button", { name: "删除记录确认" }).click();
  await expect(page.locator("[data-pui-owner='Popconfirm']")).toBeVisible();
  await expect(page.locator("button button")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-pui-owner='Popconfirm']")).toHaveCount(0);

  const lightboxOpener = page.getByRole("button", { name: "打开图片预览" });
  await lightboxOpener.click();
  const lightbox = page.getByRole("dialog", { name: "图片预览" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox).toBeFocused();
  await expect(lightbox.getByText("1 / 3")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(lightbox.getByRole("img", { name: "第二张" })).toBeVisible();
  await expect(lightbox.getByText("2 / 3")).toBeVisible();
  await page.keyboard.press("End");
  await expect(lightbox.getByRole("img", { name: "第三张" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(lightbox.getByRole("img", { name: "第一张" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(lightboxOpener).toBeFocused();

  const targetTourOpener = page.getByRole("button", { name: "打开目标引导" });
  await targetTourOpener.click();
  const targetTour = page.getByRole("dialog", { name: "功能引导" });
  await expect(targetTour).toBeVisible();
  await expect(targetTour).toBeFocused();
  const targetCard = targetTour.locator(".pui-tour__card");
  const spotlight = targetTour.locator(".pui-tour__spotlight");
  await expect(targetCard).toHaveAttribute("data-placement", /^(top|right|bottom|left)$/);
  await expect(spotlight).toBeVisible();
  const [targetBounds, spotlightBounds] = await Promise.all([
    page.locator("#tour-target").boundingBox(),
    spotlight.boundingBox(),
  ]);
  expect(targetBounds).not.toBeNull();
  expect(spotlightBounds).not.toBeNull();
  expect(Math.abs((spotlightBounds?.x ?? 0) - (targetBounds?.x ?? 0))).toBeLessThanOrEqual(8);
  expect(Math.abs((spotlightBounds?.y ?? 0) - (targetBounds?.y ?? 0))).toBeLessThanOrEqual(8);
  await page.keyboard.press("Escape");
  await expect(targetTour).toHaveCount(0);
  await expect(targetTourOpener).toBeFocused();

  const missingTourOpener = page.getByRole("button", { name: "打开缺失引导" });
  await missingTourOpener.click();
  const missingTour = page.getByRole("dialog", { name: "功能引导" });
  await expect(missingTour).toBeVisible();
  await expect(missingTour.locator(".pui-tour__scrim")).toBeVisible();
  await expect(missingTour.locator(".pui-tour__spotlight")).toHaveCount(0);
  await expect(missingTour.locator(".pui-tour__card")).not.toHaveAttribute("data-placement");
  await page.keyboard.press("Escape");
  await expect(missingTour).toHaveCount(0);
  await expect(missingTourOpener).toBeFocused();
});
