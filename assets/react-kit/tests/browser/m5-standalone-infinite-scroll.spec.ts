// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["InfiniteScroll"]}
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("InfiniteScroll standalone keyboard command shares observer ownership, retries failures, preserves focus and stops at end", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const entries: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
    class Observer {
      private entry: (typeof entries)[number];
      constructor(callback: IntersectionObserverCallback) { this.entry = { callback }; entries.push(this.entry); }
      observe(target: Element) { this.entry.target = target; }
      disconnect() { this.entry.target = undefined; }
    }
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: Observer });
    window.intersectStandaloneInfinite = () => entries.forEach(({ callback, target }) => {
      if (target) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  });
  await page.goto("/tests/fixtures/m5-standalone-infinite-scroll.html");
  await page.waitForFunction(() => Boolean(window.standaloneInfinite));
  const owner = page.locator("[data-pui-owner='InfiniteScroll']");
  const button = owner.getByRole("button");
  const before = page.getByRole("button", { name: "Before records" });
  const after = page.getByRole("button", { name: "After records" });
  const requested = () => page.evaluate(() => window.standaloneInfinite.requests);
  const intersect = () => page.evaluate(() => window.intersectStandaloneInfinite());
  await before.focus();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await expect(button).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect.poll(requested).toEqual([2]);
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toBeFocused();
  await intersect();
  await button.press("Space");
  expect(await requested()).toEqual([2]);
  await page.evaluate(() => window.standaloneInfinite.succeed());
  await expect(owner.getByRole("listitem")).toHaveCount(4);
  await expect(button).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await intersect();
  await expect.poll(requested).toEqual([2, 4]);
  await page.evaluate(() => window.standaloneInfinite.fail());
  await expect(owner.getByRole("alert")).toContainText("加载更多失败，请重试");
  await expect(button).toHaveAccessibleName("重试");
  await expect(after).toBeFocused();
  await intersect();
  expect(await requested()).toEqual([2, 4]);
  await page.evaluate(() => window.standaloneInfinite.disable(true));
  await expect(button).toBeDisabled();
  await intersect();
  expect(await requested()).toEqual([2, 4]);
  await page.evaluate(() => window.standaloneInfinite.disable(false));
  await after.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(requested).toEqual([2, 4, 4]);
  await intersect();
  expect(await requested()).toEqual([2, 4, 4]);
  await page.evaluate(() => window.standaloneInfinite.succeed(true));
  await expect(owner.getByRole("listitem")).toHaveCount(6);
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAttribute("tabindex", "-1");
  await expect(owner.getByText("已经到底了")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await intersect();
  expect(await requested()).toEqual([2, 4, 4]);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([]);
  expect(errors).toEqual([]);
});

test("InfiniteScroll keyboard loading works without IntersectionObserver", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: undefined }));
  await page.goto("/tests/fixtures/m5-standalone-infinite-scroll.html");
  const button = page.locator("[data-pui-owner='InfiniteScroll']").getByRole("button");
  await button.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => window.standaloneInfinite.requests)).toEqual([2]);
  await page.evaluate(() => window.standaloneInfinite.succeed(true));
  await expect(page.getByRole("listitem")).toHaveCount(4);
  await expect(button).toBeFocused();
});
