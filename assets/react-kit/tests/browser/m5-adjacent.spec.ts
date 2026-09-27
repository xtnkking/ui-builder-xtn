// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["Scheduler","ResizablePanels","InfiniteScroll","CommandPalette","Transfer"]}
import { expect, test } from "@playwright/test";

test("Scheduler sorts events by instant and navigates adjacent dates in its time zone", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const agenda = page.getByRole("region", { name: "Day agenda" });
  await expect(agenda.locator(".pui-scheduler > header strong")).toHaveText("Sunday, November 1, 2026");
  await expect(agenda.locator(".pui-scheduler__agenda button")).toHaveText(["Early meeting", "Middle meeting", "Late meeting"]);
  await agenda.getByRole("button", { name: "Early meeting" }).focus();
  await page.keyboard.press("Enter");
  await expect(agenda.getByLabel("Last event")).toHaveText("early");
  await agenda.getByRole("button", { name: "后一天" }).focus();
  await page.keyboard.press("Enter");
  await expect(agenda.locator(".pui-scheduler > header strong")).toHaveText("Monday, November 2, 2026");
  await expect(agenda.locator(".pui-scheduler__empty")).toBeVisible();
  await agenda.getByRole("button", { name: "前一天" }).click();
  await expect(agenda.locator(".pui-scheduler > header strong")).toHaveText("Sunday, November 1, 2026");
});

test("Scheduler follows the complete day agenda Tab order and exits after the last event", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const agenda = page.getByRole("region", { name: "Day agenda" });
  const previous = agenda.getByRole("button", { name: "前一天" });
  await previous.focus();
  await page.keyboard.press("Tab");
  await expect(agenda.getByRole("button", { name: "后一天" })).toBeFocused();
  for (const name of ["Early meeting", "Middle meeting", "Late meeting"]) {
    await page.keyboard.press("Tab");
    await expect(agenda.getByRole("button", { name })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("separator", { name: "Resize workspace" })).toBeFocused();

  await agenda.getByRole("button", { name: "后一天" }).click();
  await expect(agenda.locator(".pui-scheduler__empty")).toBeVisible();
  await agenda.getByRole("button", { name: "前一天" }).focus();
  await page.keyboard.press("Tab");
  await expect(agenda.getByRole("button", { name: "后一天" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("separator", { name: "Resize workspace" })).toBeFocused();
});

test("ResizablePanels keyboard bounds and pointer cancellation retain the resolved size", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Split workspace" });
  const separator = section.getByRole("separator", { name: "Resize workspace" });
  const first = section.getByText("First pane").locator("..");
  await expect(separator).toHaveAttribute("aria-controls", await first.getAttribute("id"));
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "42");
  await page.keyboard.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", "75");
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "25");

  const bounds = await section.locator(".pui-resizable").boundingBox();
  const handle = await separator.boundingBox();
  expect(bounds && handle).toBeTruthy();
  await separator.evaluate((element) => element.addEventListener("pointerdown", (event) => {
    (window as typeof window & { activePointerId?: number }).activePointerId = event.pointerId;
  }, { once: true }));
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.6, handle!.y + handle!.height / 2);
  await expect(separator).toHaveAttribute("aria-valuenow", "60");
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel", {
    pointerId: (window as typeof window & { activePointerId: number }).activePointerId,
  })));
  await page.mouse.move(bounds!.x + bounds!.width * 0.75, handle!.y + handle!.height / 2);
  await expect(separator).toHaveAttribute("aria-valuenow", "60");
  await page.mouse.up();
});

test("vertical ResizablePanels uses Up/Down and leaves its handle with Tab", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Vertical workspace" });
  const separator = section.getByRole("separator", { name: "Resize vertical workspace" });
  await expect(separator).toHaveAttribute("aria-orientation", "vertical");
  await section.getByRole("button", { name: "Top action" }).focus();
  await page.keyboard.press("Tab");
  await expect(separator).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(separator).toHaveAttribute("aria-valuenow", "42");
  await page.keyboard.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", "40");
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute("aria-valuenow", "40");
  await page.keyboard.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", "75");
  await page.keyboard.press("Tab");
  await expect(section.getByRole("button", { name: "Bottom action" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(separator).toBeFocused();
});

test("InfiniteScroll requests once per caller-owned cursor and reports rejected loads", async ({ page }) => {
  await page.addInitScript(() => {
    const observers: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
    class ControlledObserver {
      callback: IntersectionObserverCallback;
      target?: Element;
      constructor(callback: IntersectionObserverCallback) { this.callback = callback; observers.push(this); }
      observe(target: Element) { this.target = target; }
      disconnect() { this.target = undefined; }
    }
    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: ControlledObserver });
    (window as typeof window & { triggerSentinel: () => void }).triggerSentinel = () => {
      observers.forEach(({ callback, target }) => {
        if (target) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    };
  });
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Paged items" });
  const count = section.getByLabel("Load count");
  const trigger = () => page.evaluate(() => (window as typeof window & { triggerSentinel: () => void }).triggerSentinel());
  await trigger();
  await expect(count).toHaveText("1");
  await expect(section.locator(".pui-infinite-scroll__sentinel")).not.toContainText("正在加载更多内容");
  await trigger();
  await page.waitForTimeout(80);
  await expect(count).toHaveText("1");
  await section.getByRole("button", { name: "Advance cursor" }).click();
  await trigger();
  await expect(count).toHaveText("2");
  await section.getByRole("button", { name: "Fail next request" }).click();
  await section.getByRole("button", { name: "Advance cursor" }).click();
  await trigger();
  await expect(count).toHaveText("3");
  await expect(section.getByLabel("Load error")).toHaveText("Error: Fetch failed");
  await trigger();
  await expect(count).toHaveText("3");
  await section.getByRole("button", { name: "Advance cursor" }).click();
  await trigger();
  await expect(count).toHaveText("4");
});

test("CommandPalette focuses search, skips disabled commands, and owns async failure", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Commands" });
  const opener = section.getByRole("button", { name: "Open commands" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Commands" });
  const search = dialog.getByRole("combobox", { name: "Search commands" });
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-activedescendant", /option-0$/);
  await search.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", /option-2$/);
  await search.press("Home");
  await expect(search).toHaveAttribute("aria-activedescendant", /option-0$/);
  await search.fill("second");
  await expect(dialog.getByRole("option", { name: "Beta" })).toBeVisible();
  await search.press("Enter");
  await search.press("Enter");
  await expect(section.getByLabel("Command count")).toHaveText("1");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await search.fill("Failure");
  await search.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(section.getByLabel("Command error")).toHaveText("Error: Command failed");
  await search.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("CommandPalette empty and loading results keep Tab inside the Dialog and restore the opener", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Commands" });
  const dialog = page.getByRole("dialog", { name: "Commands" });
  const search = dialog.getByRole("combobox", { name: "Search commands" });
  const close = dialog.getByRole("button", { name: "关闭对话框" });
  const normalOpener = section.getByRole("button", { name: "Open commands", exact: true });
  await normalOpener.click();
  await search.fill("no matching command");
  await expect(dialog.getByText("没有匹配命令")).toBeVisible();
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await search.press("Enter");
  await expect(dialog).toBeVisible();
  await search.press("Tab");
  const clear = dialog.getByRole("button", { name: "清除搜索" });
  await expect(clear).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await search.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(normalOpener).toBeFocused();

  const loadingOpener = section.getByRole("button", { name: "Open loading commands" });
  await loadingOpener.click();
  await expect(search).toBeFocused();
  await search.fill("");
  await expect(dialog.getByText("正在加载")).toBeVisible();
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(search).not.toHaveAttribute("aria-activedescendant");
  await search.press("Enter");
  await expect(section.getByLabel("Command count")).toHaveText("0");
  await search.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await close.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(loadingOpener).toBeFocused();
});

test("Transfer retains native range selection and moves focus with form values", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-adjacent.html");
  const section = page.getByRole("region", { name: "Transfer members" });
  const form = section.locator("form");
  const source = section.getByRole("listbox", { name: "Available" });
  const target = section.getByRole("listbox", { name: "Chosen" });
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
  await expect(source.getByRole("option", { name: "Blocked" })).toHaveAttribute("disabled", "");
  await source.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+ArrowDown");
  await expect.poll(() => source.evaluate((element: HTMLSelectElement) =>
    Array.from(element.selectedOptions, (option) => option.value))).toEqual(["alpha", "gamma"]);
  const add = section.getByRole("button", { name: "添加选中项" });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(target).toBeFocused();
  await expect(target.getByRole("option", { name: "Alpha" })).toBeVisible();
  await expect(target.getByRole("option", { name: "Gamma" })).toBeVisible();
  await expect(source.getByRole("option", { name: "Blocked" })).toHaveAttribute("disabled", "");
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
  await section.getByRole("button", { name: "Submit members" }).click();
  await expect(section.getByLabel("Submitted members")).toHaveText("alpha,gamma");

  await section.getByRole("button", { name: "移除选中项" }).focus();
  await page.keyboard.press("Enter");
  await expect(source).toBeFocused();
  await expect(target.getByRole("option", { name: "Alpha" })).toHaveCount(0);
  await section.getByRole("button", { name: "Reset members" }).click();
  expect(await form.evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(false);
});
