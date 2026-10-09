// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["LocaleProvider","usePersonalUILocale"]}
import { expect, test } from "@playwright/test";

test.describe("locale geometry", () => {
  test("renders zh-CN and long en-US labels without clipping or control drift", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/components/locale");

    await expect(page.getByRole("heading", { level: 1, name: "LocaleProvider / usePersonalUILocale" })).toBeVisible();
    const overview = page.getByRole("tabpanel", { name: "总览", exact: true });
    await expect(overview).toBeVisible();
    const zh = overview.locator('[data-locale-example="zh-CN"]');
    const en = overview.locator('[data-locale-example="en-US"]');
    await expect(zh).toContainText("12 条结果");
    await expect(en).toContainText("12 results");
    await expect(zh.getByRole("navigation", { name: "数据分页" })).toBeVisible();
    await expect(en.getByRole("navigation", { name: "Data pagination" })).toBeVisible();

    const [zhButton, enButton] = await Promise.all([
      zh.getByRole("button", { name: "上一页" }).boundingBox(),
      en.getByRole("button", { name: "Previous page" }).boundingBox(),
    ]);
    expect(zhButton).not.toBeNull();
    expect(enButton).not.toBeNull();
    expect(enButton?.height).toBe(zhButton?.height);

    for (const surface of [zh, en]) {
      const clippedControls = await surface.locator("button").evaluateAll((controls) => controls.filter((control) => (
        control.scrollWidth > control.clientWidth + 1 || control.scrollHeight > control.clientHeight + 1
      )).length);
      expect(clippedControls).toBe(0);
    }

    await page.setViewportSize({ width: 320, height: 720 });
    await expect.poll(() => page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))).toEqual({ clientWidth: 320, scrollWidth: 320 });
    await expect(en.getByRole("navigation", { name: "Data pagination" })).toBeVisible();
  });
});
