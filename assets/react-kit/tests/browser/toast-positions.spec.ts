// @ui-coverage {"kind":"browser","runner":"browser","exports":["ToastProvider","useToast"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page) {
  await page.goto("/#/components/toast");
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  await preview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
  return preview;
}

async function freezeClock(page: Page) {
  const time = new Date("2026-10-13T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
}

async function launch(preview: Locator, name: string) {
  // Keyboard activation avoids a notification overlapping an example launcher.
  await preview.getByRole("button", { name, exact: true }).press("Enter");
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function expectStable(actual: Awaited<ReturnType<typeof bounds>>, before: Awaited<ReturnType<typeof bounds>>) {
  expect(actual.x).toBeCloseTo(before.x, 0);
  expect(actual.y).toBeCloseTo(before.y, 0);
  expect(actual.width).toBeCloseTo(before.width, 0);
  expect(actual.height).toBeCloseTo(before.height, 0);
}

test("Toast wide positions stack independently without moving unrelated center or bottom messages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page);
  await freezeClock(page);
  const center = page.locator(".ui-toast-viewport--top-center .ui-toast");
  const right = page.locator(".ui-toast-viewport--top-right .ui-toast");
  const bottom = page.locator(".ui-toast-viewport--bottom-right .ui-toast");

  for (const width of [1440, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await launch(preview, "长内容提示");
    await launch(preview, "手动关闭提示");
    await launch(preview, "长内容提示");
    await launch(preview, "居中成功提示");
    await launch(preview, "右下错误胶囊");
    await launch(preview, "右下错误胶囊");
    await expect(page.locator(".ui-toast")).toHaveCount(6);
    await expect(right).toHaveCount(3);
    await expect(center).toHaveCount(1);
    await expect(bottom).toHaveCount(2);

    const centerBefore = await bounds(center);
    const rightFirst = await bounds(right.first());
    const bottomBefore = await bounds(bottom.first());
    expect(centerBefore.y).toBeCloseTo(18, 0);
    expect(centerBefore.x + centerBefore.width / 2).toBeCloseTo(width / 2, 0);
    expect(rightFirst.y).toBeCloseTo(18, 0);
    expect(width - rightFirst.x - rightFirst.width).toBeCloseTo(18, 0);
    expect(centerBefore.x + centerBefore.width).toBeLessThan(rightFirst.x);
    expect(width - bottomBefore.x - bottomBefore.width).toBeCloseTo(18, 0);
    expect(1000 - bottomBefore.y - bottomBefore.height).toBeCloseTo(18, 0);
    const rightBoxes = await right.evaluateAll((nodes) => nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { y: box.y, bottom: box.bottom };
    }));
    for (let index = 1; index < rightBoxes.length; index += 1) {
      expect(rightBoxes[index].y - rightBoxes[index - 1].bottom).toBeCloseTo(10, 0);
    }
    await page.screenshot({ path: test.info().outputPath(`toast-independent-${width}.png`), animations: "disabled" });

    await right.first().getByRole("button", { name: "关闭通知：长内容通知", exact: true }).click();
    await expect(right).toHaveCount(2);
    expectStable(await bounds(center), centerBefore);
    expectStable(await bounds(bottom.first()), bottomBefore);
    const rightAfterClose = await bounds(right.first());
    expect(rightAfterClose.y).toBeCloseTo(18, 0);
    await center.getByRole("button", { name: "关闭通知：成员权限已保存。", exact: true }).click();
    await expect(center).toHaveCount(0);
    expectStable(await bounds(right.first()), rightAfterClose);
    expectStable(await bounds(bottom.first()), bottomBefore);
    await launch(preview, "清空全部提示");
    await expect(page.locator(".ui-toast")).toHaveCount(0);
  }
});

test("Toast narrow positions preserve top anchors separate scroll areas and readable cards", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const preview = await previewFor(page);
  await freezeClock(page);
  const centerViewport = page.locator(".ui-toast-viewport--top-center");
  const rightViewport = page.locator(".ui-toast-viewport--top-right");
  const bottomViewport = page.locator(".ui-toast-viewport--bottom-right");
  const center = centerViewport.locator(".ui-toast");
  const right = rightViewport.locator(".ui-toast");
  const bottom = bottomViewport.locator(".ui-toast");

  for (const width of [320, 1024]) {
    await page.setViewportSize({ width, height: 600 });
    await launch(preview, "长内容提示");
    await launch(preview, "手动关闭提示");
    await launch(preview, "居中成功提示");
    await launch(preview, "右下错误胶囊");
    await expect(page.locator(".ui-toast")).toHaveCount(4);
    const inset = width <= 640 ? 12 : 18;
    await expect.poll(async () => {
      const [topBox, rightBox] = await Promise.all([center.boundingBox(), right.first().boundingBox()]);
      return topBox && rightBox ? rightBox.y - topBox.y - topBox.height : -1;
    }).toBeCloseTo(10, 0);
    const centerBox = await bounds(center);
    const longBox = await bounds(right.first());
    const bottomBox = await bounds(bottom);
    expect(centerBox.y).toBeCloseTo(inset, 0);
    expect(centerBox.x + centerBox.width / 2).toBeCloseTo(width / 2, 0);
    // A traditional scrollbar consumes the right scroll area's own width.
    expect(longBox.x).toBeGreaterThanOrEqual(inset - 1);
    expect(longBox.x + longBox.width).toBeLessThanOrEqual(width - inset + 1);
    expect(600 - bottomBox.y - bottomBox.height).toBeCloseTo(inset, 0);
    expect(longBox.height).toBeGreaterThan(100);
    const topRegion = await bounds(rightViewport);
    const bottomRegion = await bounds(bottomViewport);
    expect(topRegion.y + topRegion.height).toBeLessThanOrEqual(301);
    expect(topRegion.y + topRegion.height).toBeLessThanOrEqual(bottomRegion.y);
    expect(await rightViewport.evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    if (width === 320) {
      expect(await rightViewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      const heights = await right.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      expect(heights[1]).toBeGreaterThanOrEqual(58);
    }
    await page.screenshot({ path: test.info().outputPath(`toast-separated-narrow-${width}.png`), animations: "disabled" });

    await center.getByRole("button", { name: "关闭通知：成员权限已保存。", exact: true }).click();
    await expect(center).toHaveCount(0);
    await expect.poll(async () => (await right.first().boundingBox())?.y ?? -1).toBeCloseTo(inset, 0);
    expectStable(await bounds(bottom), bottomBox);
    await launch(preview, "清空全部提示");
    await expect(page.locator(".ui-toast")).toHaveCount(0);
  }
});

test("Toast resize retains pending action identity and original completion across independent positions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page);
  await freezeClock(page);
  await launch(preview, "异步操作提示");
  await launch(preview, "居中成功提示");
  await launch(preview, "右下错误胶囊");
  const actionCard = page.locator('.ui-toast[data-position="top-right"]').filter({ has: page.locator(".ui-toast__copy > strong", { hasText: "文件已移至回收站" }) });
  const action = actionCard.getByRole("button", { name: "撤销", exact: true });
  const originalCard = await actionCard.elementHandle();
  expect(originalCard).not.toBeNull();
  await action.click();
  const loading = actionCard.getByRole("button", { name: "正在撤销", exact: true });
  await expect(loading).toHaveAttribute("aria-disabled", "true");
  await page.clock.runFor(500);

  for (const width of [1024, 320]) {
    await page.setViewportSize({ width, height: 600 });
    await page.clock.runFor(100);
    await expect(loading).toBeVisible();
    expect(await actionCard.evaluate((node, original) => node === original, originalCard)).toBe(true);
    const [centerBox, rightBox] = await Promise.all([
      bounds(page.locator(".ui-toast-viewport--top-center .ui-toast")), bounds(actionCard),
    ]);
    expect(rightBox.y - centerBox.y - centerBox.height).toBeCloseTo(10, 0);
    await loading.press("Enter");
    await expect(loading).toHaveAttribute("aria-disabled", "true");
  }
  //700ms elapsed: the original 1200ms promise completes after another 500ms.
  await page.clock.runFor(510);
  await expect(actionCard).toHaveCount(0);
  await expect(page.locator(".ui-toast")).toHaveCount(2);
  await expect(page.locator(".ui-toast-viewport--top-center .ui-toast")).toHaveCount(1);
  await expect(page.locator(".ui-toast-viewport--bottom-right .ui-toast")).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath("toast-resize-action-complete.png"), animations: "disabled" });
});
