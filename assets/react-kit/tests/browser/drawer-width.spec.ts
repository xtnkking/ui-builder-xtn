// @ui-coverage {"kind":"browser","runner":"browser","exports":["Drawer"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function overview(page: Page) {
  await page.goto("/#/components/drawer");
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
}

async function openDrawer(page: Page, preview: Locator, name: string) {
  await preview.getByRole("button", { name, exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "成员详情", exact: true });
  await expect(drawer).toBeVisible();
  await expect(page.locator(".ui-overlay--drawer")).toHaveAttribute("data-ui-motion", "open");
  return drawer;
}

async function closeDrawer(page: Page, drawer: Locator) {
  await drawer.getByRole("button", { name: "关闭抽屉", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
}

async function rect(drawer: Locator) {
  const box = await drawer.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("Drawer preserves desktop presets and supports numeric px percent and vw widths", async ({ page }, info) => {
  const preview = await overview(page);
  for (const [name, expected] of [
    ["打开成员详情", 460],
    ["大号 620px", 620],
    ["自定义 800px", 800],
    ["自定义 960px", 960],
    ["可用宽度 75%", 1080],
    ["视口宽度 80vw", 1152],
  ] as const) {
    const drawer = await openDrawer(page, preview, name);
    const box = await rect(drawer);
    expect(box.width).toBeCloseTo(expected, 0);
    expect(box.x + box.width).toBeCloseTo(1440, 0);
    expect(box.y).toBeCloseTo(0, 0);
    expect(box.height).toBeCloseTo(900, 0);
    expect(await drawer.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    if (name === "自定义 800px") await page.screenshot({ path: info.outputPath("drawer-custom-800-1440.png") });
    await closeDrawer(page, drawer);
    await expect(preview.getByRole("button", { name, exact: true })).toBeFocused();
  }
});

test("Drawer clamps oversized inset width and fullscreen overrides width and inset gaps", async ({ page }, info) => {
  const preview = await overview(page);
  const inset = await openDrawer(page, preview, "超宽 2000px（留边）");
  const padding = await page.locator(".ui-overlay--drawer").evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight), top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) };
  });
  const insetBox = await rect(inset);
  expect(padding.left).toBeGreaterThan(0);
  expect(padding.right).toBeGreaterThan(0);
  expect(insetBox.x).toBeCloseTo(padding.left, 0);
  expect(insetBox.width).toBeCloseTo(1440 - padding.left - padding.right, 0);
  expect(insetBox.y).toBeCloseTo(padding.top, 0);
  expect(insetBox.y + insetBox.height).toBeCloseTo(900 - padding.bottom, 0);
  await closeDrawer(page, inset);

  const fullscreen = await openDrawer(page, preview, "全屏（忽略宽度）");
  const fullBox = await rect(fullscreen);
  expect(fullBox.x).toBeCloseTo(0, 0);
  expect(fullBox.y).toBeCloseTo(0, 0);
  expect(fullBox.width).toBeCloseTo(1440, 0);
  expect(fullBox.height).toBeCloseTo(900, 0);
  await expect(fullscreen).toHaveCSS("border-top-left-radius", "0px");
  await page.screenshot({ path: info.outputPath("drawer-fullscreen-1440.png") });
  await closeDrawer(page, fullscreen);
});

test("Drawer keeps mobile custom widths within a bottom sheet and fullscreen fills 320px viewport", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const preview = await overview(page);
  for (const name of ["自定义 800px", "可用宽度 75%", "视口宽度 80vw", "超宽 2000px（留边）"]) {
    const drawer = await openDrawer(page, preview, name);
    const box = await rect(drawer);
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(320, 0);
    expect(box.y).toBeGreaterThan(0);
    expect(box.y + box.height).toBeCloseTo(740, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(await drawer.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    if (name === "自定义 800px") await page.screenshot({ path: info.outputPath("drawer-bottom-sheet-320.png") });
    await closeDrawer(page, drawer);
  }
  const full = await openDrawer(page, preview, "全屏（忽略宽度）");
  const fullBox = await rect(full);
  expect(fullBox.x).toBeCloseTo(0, 0);
  expect(fullBox.y).toBeCloseTo(0, 0);
  expect(fullBox.width).toBeCloseTo(320, 0);
  expect(fullBox.height).toBeCloseTo(740, 0);
  await page.screenshot({ path: info.outputPath("drawer-fullscreen-320.png") });
  await closeDrawer(page, full);
});

test("Drawer custom width retains default motion focus trap Escape and trigger restoration", async ({ page }, info) => {
  const preview = await overview(page);
  const trigger = preview.getByRole("button", { name: "自定义 800px", exact: true });
  const capture = page.evaluate(async () => {
    const frames: Array<{ state: string; translateX: number }> = [];
    const start = performance.now();
    while (performance.now() - start < 550) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const overlay = document.querySelector<HTMLElement>(".ui-overlay--drawer");
      const panel = overlay?.querySelector<HTMLElement>('[data-ui-owner="Drawer"]');
      if (overlay && panel) {
        const transform = getComputedStyle(panel).transform;
        frames.push({ state: overlay.dataset.uiMotion ?? "", translateX: transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41 });
      }
    }
    return frames;
  });
  const drawer = await openDrawer(page, preview, "自定义 800px");
  const frames = await capture;
  await info.attach("drawer-custom-entrance-motion.json", { body: JSON.stringify(frames), contentType: "application/json" });
  expect(frames.some((frame) => frame.state === "entering" && frame.translateX > 0 && frame.translateX < 800)).toBe(true);
  await expect(drawer.getByRole("button", { name: "关闭", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "关闭抽屉", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "保存", exact: true })).toBeFocused();
  await page.mouse.click(10, 450);
  await expect(drawer).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  const reopened = await openDrawer(page, preview, "自定义 800px");
  await closeDrawer(page, reopened);
  await expect(trigger).toBeFocused();
});
