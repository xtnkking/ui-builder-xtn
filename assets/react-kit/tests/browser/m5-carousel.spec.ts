// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Carousel"]}
import { expect, test } from "@playwright/test";

test("Carousel keyboard controls expose one slide, positions, and boundaries", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-carousel.html");
  const carousel = page.getByRole("region", { name: "Manual highlights" });
  const stage = carousel.locator(".pui-carousel__stage");
  await expect(stage).toHaveAttribute("aria-label", "1 / 3: First");
  await expect(carousel.getByRole("button", { name: "上一项" })).toBeDisabled();
  await carousel.getByRole("button", { name: "下一项" }).focus();
  await page.keyboard.press("Enter");
  await expect(stage).toHaveAttribute("aria-label", "2 / 3: Second");
  await expect(carousel.getByRole("button", { name: "Second slide action" })).toBeVisible();
  await expect(carousel.getByRole("button", { name: "First slide action" })).toHaveCount(0);
  await carousel.getByRole("button", { name: "显示 Third" }).focus();
  await page.keyboard.press("Space");
  await expect(stage).toHaveAttribute("aria-label", "3 / 3: Third");
  await expect(carousel.getByRole("button", { name: "下一项" })).toBeDisabled();
  await expect(carousel.getByRole("button", { name: "显示 Third" })).toHaveAttribute("aria-current", "true");

  const empty = page.getByRole("region", { name: "Empty highlights" });
  await expect(empty.getByRole("button", { name: "上一项" })).toBeDisabled();
  await expect(empty.getByRole("button", { name: "下一项" })).toBeDisabled();
});

test("Carousel manual pause survives hover and reacts to reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/m5-carousel.html");
  const carousel = page.getByRole("region", { name: "Auto highlights" });
  const stage = carousel.locator(".pui-carousel__stage");
  await expect(stage).toHaveAttribute("aria-live", "off");
  await carousel.hover();
  await expect(stage).toHaveAttribute("aria-live", "polite");
  await carousel.getByRole("button", { name: "暂停自动播放" }).click();
  await page.mouse.move(1, 1);
  await page.getByRole("region", { name: "Manual highlights" }).getByRole("button", { name: "下一项" }).focus();
  await expect(carousel.getByRole("button", { name: "继续自动播放" })).toBeEnabled();
  await expect(stage).toHaveAttribute("aria-live", "polite");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(carousel.getByRole("button", { name: "自动播放已根据减少动态效果设置暂停" })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(carousel.getByRole("button", { name: "继续自动播放" })).toBeEnabled();
  await carousel.getByRole("button", { name: "继续自动播放" }).click();
  const otherControl = page.getByRole("region", { name: "Manual highlights" }).getByRole("button", { name: "下一项" });
  await otherControl.focus();
  await page.mouse.move(1, 1);
  await expect(otherControl).toBeFocused();
  await expect.poll(() => carousel.evaluate((element) => ({
    hovered: element.matches(":hover"),
    focused: element.contains(document.activeElement),
    active: document.activeElement?.getAttribute("aria-label"),
  }))).toEqual({ hovered: false, focused: false, active: "下一项" });
  await expect(stage).toHaveAttribute("aria-live", "off");
  await expect(stage).not.toHaveAttribute("aria-label", "1 / 3: First", { timeout: 3000 });
});
