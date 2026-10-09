// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["InfiniteScroll","LoadMore"]}
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("official infinite pair owns keyboard, observer, rejection retry, end, and focus", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.addInitScript(() => {
    const observers: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
    class Observer {
      private entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) { this.entry = { callback }; observers.push(this.entry); }
      observe(target: Element) { this.entry.target = target; }
      disconnect() { this.entry.target = undefined; }
    }
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: Observer });
    (window as typeof window & { triggerInfinite: () => void; unhandledInfinite: string[] }).unhandledInfinite = [];
    window.addEventListener("unhandledrejection", (event) => (window as typeof window & { unhandledInfinite: string[] }).unhandledInfinite.push(String(event.reason)));
    (window as typeof window & { triggerInfinite: () => void }).triggerInfinite = () => observers.forEach(({ callback, target }) => {
      if (target) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  });
  await page.goto("/tests/fixtures/infinite-scroll-composition.html");
  await page.waitForFunction(() => Boolean(window.infiniteFixture));
  const region = page.getByRole("region", { name: "连续记录" });
  const state = region.getByRole("status", { name: "加载状态" });
  const before = page.getByRole("button", { name: "Before records" });
  const after = page.getByRole("button", { name: "After records" });
  const manual = region.getByRole("button", { name: "手动加载下一页" });
  const cursors = () => page.evaluate(() => window.infiniteFixture.requestedCursors);
  const trigger = () => page.evaluate(() => (window as typeof window & { triggerInfinite: () => void }).triggerInfinite());
  const succeed = () => page.evaluate(() => window.infiniteFixture.succeed());
  const axe = async () => {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
  };

  await before.focus();
  await page.keyboard.press("Tab");
  await expect(manual).toBeFocused();
  await expect(region.getByRole("button")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect.poll(cursors).toEqual([2]);
  await expect(region.getByRole("button", { name: "正在加载下一页" })).toBeDisabled();
  await expect(region.getByRole("listitem")).toHaveCount(2);
  await trigger();
  expect(await cursors()).toEqual([2]);
  await succeed();
  await expect(region.getByRole("listitem")).toHaveCount(4);
  await expect(state).toContainText("cursor 4");
  await expect(manual).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();

  // The observer requests the same shared next cursor without stealing focus.
  await trigger();
  await expect.poll(cursors).toEqual([2, 4]);
  await expect(region.getByRole("listitem")).toHaveCount(4);
  await succeed();
  await expect(region.getByRole("listitem")).toHaveCount(6);
  await expect(state).toContainText("cursor 6");
  await expect(after).toBeFocused();
  await trigger();
  await expect.poll(cursors).toEqual([2, 4, 6]);
  await page.evaluate(() => window.infiniteFixture.fail());
  await expect(region.getByRole("alert")).toContainText("服务器暂不可用");
  await expect(region.getByRole("alert")).toHaveAttribute("data-pui-owner", "Alert");
  await expect(state).toContainText("cursor 6");
  await expect(region.getByRole("listitem")).toHaveCount(6);
  await expect(manual).toBeEnabled();
  await expect(after).toBeFocused();
  await axe();

  // Both entrances respect disabled; returning to ready permits manual retry.
  await page.evaluate(() => window.infiniteFixture.setDisabled(true));
  await expect(manual).toBeDisabled();
  await trigger();
  expect(await cursors()).toEqual([2, 4, 6]);
  await page.evaluate(() => window.infiniteFixture.setDisabled(false));
  await expect(manual).toBeEnabled();
  await after.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(manual).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(cursors).toEqual([2, 4, 6, 6]);
  await expect(region.getByRole("listitem")).toHaveCount(6);
  await trigger();
  expect(await cursors()).toEqual([2, 4, 6, 6]);
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await succeed();
  await expect(region.getByRole("listitem")).toHaveCount(8);
  await expect(state).toContainText("cursor 8");
  await expect(region.getByRole("button")).toHaveCount(0);
  await expect(region.getByText("没有更多内容")).toBeVisible();
  await expect(after).toBeFocused();
  await trigger();
  expect(await cursors()).toEqual([2, 4, 6, 6]);
  await axe();
  expect(await page.evaluate(() => (window as typeof window & { unhandledInfinite: string[] }).unhandledInfinite)).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});
