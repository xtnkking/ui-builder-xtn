// @ui-coverage {"kind":"browser","runner":"browser","exports":["ToastProvider","useToast"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page, state = "总览") {
  await page.goto("/#/components/toast");
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}

async function sendRoundedStack(preview: Locator, count: number) {
  const launcher = preview.getByRole("button", { name: "异步操作提示", exact: true });
  await launcher.focus();
  // Keyboard activation remains usable when the growing stack covers the launcher.
  for (let index = 0; index < count; index += 1) await launcher.press("Enter");
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("Toast shadows retain rounded gutters for stacked right centered bottom and dark notifications", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page);
  // This stress fixture deliberately exceeds the product default of three cards.
  await preview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
  const frozenTime = new Date("2026-10-13T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(new Date(frozenTime.getTime() + 1000));
  await sendRoundedStack(preview, 4);
  const top = page.locator(".ui-toast-viewport--top-right");
  const rounded = top.locator('.ui-toast[data-shape="rounded"][data-position="top-right"]');
  await expect(rounded).toHaveCount(4);
  const viewport = await bounds(top);
  const first = await bounds(rounded.first());
  const last = await bounds(rounded.last());
  expect(first.y - viewport.y).toBeCloseTo(18, 0);
  expect(viewport.x + viewport.width - first.x - first.width).toBeCloseTo(18, 0);
  expect(viewport.y + viewport.height - last.y - last.height).toBeCloseTo(18, 0);
  expect(first.width).toBeLessThanOrEqual(420);
  expect(await top.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  const lightShadow = await rounded.first().evaluate((node) => getComputedStyle(node).boxShadow);
  expect(lightShadow).not.toBe("none");
  expect(await rounded.first().evaluate((node) => getComputedStyle(node).borderRadius)).toBe("12px");
  await page.screenshot({ path: test.info().outputPath("toast-rounded-stack-shadow.png"), animations: "disabled" });

  await preview.getByRole("button", { name: "居中成功提示", exact: true }).press("Enter");
  const center = await bounds(page.locator('.ui-toast-viewport--top-center .ui-toast[data-position="top-center"]'));
  expect(center.x + center.width / 2).toBeCloseTo(720, 0);
  await preview.getByRole("button", { name: "右下错误胶囊", exact: true }).press("Enter");
  const bottom = page.locator(".ui-toast-viewport--bottom-right");
  const pill = bottom.locator('.ui-toast[data-shape="pill"]');
  const pillBox = await bounds(pill);
  const bottomBox = await bounds(bottom);
  expect(pillBox.width).toBeGreaterThanOrEqual(300);
  expect(pillBox.width).toBeLessThanOrEqual(420);
  expect(1440 - pillBox.x - pillBox.width).toBeCloseTo(18, 0);
  expect(1000 - pillBox.y - pillBox.height).toBeCloseTo(18, 0);
  expect(bottomBox.width - pillBox.width).toBeGreaterThanOrEqual(36);
  expect(await pill.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("999px");

  await page.getByRole("tab", { name: "深色模式", exact: true }).click();
  await expect(page.locator(".ui-toast")).toHaveCount(0);
  const darkPreview = page.getByRole("tabpanel", { name: "深色模式", exact: true }).locator(".demo-explorer-preview");
  await darkPreview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
  await sendRoundedStack(darkPreview, 4);
  await expect(rounded).toHaveCount(4);
  const darkShadow = await rounded.first().evaluate((node) => getComputedStyle(node).boxShadow);
  expect(darkShadow).not.toBe("none");
  expect(darkShadow).not.toBe(lightShadow);
  const darkLast = await bounds(rounded.last());
  const darkViewport = await bounds(top);
  expect(darkViewport.y + darkViewport.height - darkLast.y - darkLast.height).toBeCloseTo(18, 0);
  await page.screenshot({ path: test.info().outputPath("toast-dark-stack-shadow.png"), animations: "disabled" });
});

test("Toast mobile stacks scroll without shrinking cards clipping horizontal content or intercepting gutters", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const preview = await previewFor(page);
  await preview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
  await sendRoundedStack(preview, 1);
  const viewport = page.locator(".ui-toast-viewport--top-right");
  const cards = viewport.locator(".ui-toast");
  const original = await bounds(cards.first());
  await sendRoundedStack(preview, 7);
  await expect(cards).toHaveCount(8);
  const dimensions = await viewport.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
    padding: getComputedStyle(node).padding,
  }));
  expect(dimensions.padding).toBe("12px");
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  expect(dimensions.clientHeight).toBeLessThanOrEqual(600);
  expect(dimensions.scrollWidth - dimensions.clientWidth).toBeLessThanOrEqual(1);
  const heights = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(original.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.elementFromPoint(4, 24)?.closest(".ui-toast-viewport") == null)).toBe(true);

  const pageScroll = await page.evaluate(() => window.scrollY);
  await viewport.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const last = cards.last();
  const close = last.getByRole("button", { name: "关闭通知：文件已移至回收站", exact: true });
  await expect(close).toBeVisible();
  const lastBox = await bounds(last);
  const viewportBox = await bounds(viewport);
  expect(lastBox.x).toBeGreaterThanOrEqual(11);
  expect(lastBox.x + lastBox.width).toBeLessThanOrEqual(309);
  expect(viewportBox.y + viewportBox.height - lastBox.y - lastBox.height).toBeCloseTo(12, 0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
  await page.screenshot({ path: test.info().outputPath("toast-mobile-scrolled-shadow.png"), animations: "disabled" });
  await close.click();
  await expect(cards).toHaveCount(7);
});
