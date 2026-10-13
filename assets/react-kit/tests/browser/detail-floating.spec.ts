// @ui-coverage {"kind":"browser","runner":"browser","exports":["Popover","Select"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

const matchedPopoverName = "与触发器等宽的详细筛选说明";
type ViewportGeometry = { width: number; height: number; offsetLeft: number; offsetTop: number };
type SimulatedViewport = EventTarget & ViewportGeometry;
type TestWindow = Window & { __detailViewport: SimulatedViewport };

async function longPreview(page: Page) {
  await page.getByRole("tab", { name: "长内容", exact: true }).click();
  return page.getByRole("tabpanel", { name: "长内容", exact: true }).locator(".demo-explorer-preview");
}

async function previewFor(page: Page, family: string) {
  await page.goto(`/#/components/${family}`);
  return longPreview(page);
}

async function capture(surface: Locator, name: string) {
  await surface.screenshot({ path: test.info().outputPath(`${name}.png`), animations: "disabled" });
}

async function geometry(surface: Locator) {
  return surface.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const viewport = window.visualViewport;
    const offsetLeft = viewport?.offsetLeft ?? 0;
    const offsetTop = viewport?.offsetTop ?? 0;
    const width = viewport?.width || document.documentElement.clientWidth;
    const height = viewport?.height || document.documentElement.clientHeight;
    const style = getComputedStyle(node);
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      left: offsetLeft + 12,
      right: offsetLeft + width - 12,
      top: offsetTop + 12,
      bottom: offsetTop + height - 12,
      maxWidth: Number.parseFloat(style.getPropertyValue("--ui-floating-max-width")),
      maxHeight: Number.parseFloat(style.getPropertyValue("--ui-floating-max-height")),
      positioned: node.getAttribute("data-positioned"),
    };
  });
}

async function expectWithinVisibleViewport(surface: Locator, matchedTrigger?: Locator) {
  await expect(surface).toBeVisible();
  // Positioning can be scheduled in requestAnimationFrame after viewport events.
  // Poll actual rendered geometry rather than imposing a timing delay.
  await expect.poll(async () => {
    const box = await geometry(surface);
    const triggerWidth = matchedTrigger
      ? await matchedTrigger.evaluate(node => node.getBoundingClientRect().width)
      : 0;
    return {
      positioned: box.positioned === "true",
      fitsLeft: box.x >= box.left - 1,
      fitsRight: box.x + box.width <= box.right + 1,
      fitsTop: box.y >= box.top - 1,
      fitsBottom: box.y + box.height <= box.bottom + 1,
      matchesTrigger: box.width >= Math.min(triggerWidth, box.right - box.left) - 1,
    };
  }).toEqual({ positioned: true, fitsLeft: true, fitsRight: true, fitsTop: true, fitsBottom: true, matchesTrigger: true });
}

async function simulateViewport(page: Page, viewport: ViewportGeometry, eventType: "resize" | "scroll") {
  await page.evaluate(({ next, type }) => {
    const simulated = (window as TestWindow).__detailViewport;
    Object.assign(simulated, next);
    simulated.dispatchEvent(new Event(type));
  }, { next: viewport, type: eventType });
}

test("matched Popover remains bounded when its long trigger moves from desktop to 320px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const preview = await previewFor(page, "popover");
  const trigger = preview.getByRole("button", { name: matchedPopoverName, exact: true });
  const surface = page.getByRole("dialog", { name: matchedPopoverName, exact: true });
  await trigger.click();
  await expectWithinVisibleViewport(surface, trigger);
  await capture(surface, "matched-popover-desktop");

  await page.setViewportSize({ width: 320, height: 900 });
  await expectWithinVisibleViewport(surface, trigger);
  await capture(surface, "matched-popover-320");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(surface).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Popover and Select react to VisualViewport-only resize and scroll events", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let preview = await previewFor(page, "popover");
  // This synthetic viewport proves event handling and geometry constraints.
  // It is not a certificate of actual iOS keyboard, zoom, or browser compatibility.
  await page.evaluate(() => {
    const simulated = Object.assign(new EventTarget(), {
      width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0,
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: simulated });
    Object.defineProperty(window, "__detailViewport", { configurable: true, value: simulated });
  });

  for (const family of ["popover", "select"] as const) {
    if (family === "select") {
      // Hash navigation keeps the same document and synthetic EventTarget.
      await page.evaluate(() => { window.location.hash = "/components/select"; });
      await expect(page.getByRole("heading", { name: "紧凑、搜索与异步选择", exact: true })).toBeVisible();
      preview = await longPreview(page);
      await simulateViewport(page, { width: 1440, height: 900, offsetLeft: 0, offsetTop: 0 }, "resize");
    }
    const trigger = family === "popover"
      ? preview.getByRole("button", { name: matchedPopoverName, exact: true })
      : preview.getByRole("combobox", { name: /^长选项，当前值：/ });
    const surface = family === "popover"
      ? page.getByRole("dialog", { name: matchedPopoverName, exact: true })
      : page.getByRole("listbox", { name: "长选项", exact: true });
    await trigger.click();
    await expectWithinVisibleViewport(surface);
    if (family === "select") await expect(trigger).toBeFocused();
    const originalMaxWidth = (await geometry(surface)).maxWidth;

    // Only the mocked VisualViewport dispatches these events; window does not resize.
    await simulateViewport(page, { width: 420, height: 300, offsetLeft: 64, offsetTop: 48 }, "resize");
    await expect.poll(async () => (await geometry(surface)).maxWidth).toBe(396);
    await expectWithinVisibleViewport(surface);
    const resized = await geometry(surface);
    expect(resized.maxWidth).toBeLessThan(originalMaxWidth);
    expect(resized.maxHeight).toBeGreaterThan(0);
    expect(resized.maxHeight).toBeLessThanOrEqual(276);

    await simulateViewport(page, { width: 420, height: 300, offsetLeft: 104, offsetTop: 96 }, "scroll");
    await expectWithinVisibleViewport(surface);
    await expect.poll(async () => {
      const scrolled = await geometry(surface);
      return Math.abs(scrolled.x - resized.x) + Math.abs(scrolled.y - resized.y);
    }).toBeGreaterThan(1);
    const scrolled = await geometry(surface);
    expect(scrolled.maxWidth).toBe(396);
    expect(scrolled.maxHeight).toBeGreaterThan(0);
    expect(scrolled.maxHeight).toBeLessThanOrEqual(276);
    await capture(surface, `${family}-synthetic-visible-viewport`);
    await page.keyboard.press("Escape");
    await expect(surface).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});
