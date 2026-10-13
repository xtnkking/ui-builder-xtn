// @ui-coverage {"kind":"browser","runner":"browser","exports":["ToastProvider","useToast"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page) {
  await page.goto("/#/components/toast");
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
}

async function freezeClock(page: Page) {
  const time = new Date("2026-10-13T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
}

async function launch(preview: Locator, name: string) {
  // Keyboard activation keeps examples usable even when a Toast covers the launcher.
  await preview.getByRole("button", { name, exact: true }).press("Enter");
}

async function choose(page: Page, preview: Locator, label: string, option: string) {
  // Select includes its current value in the accessible name.
  await preview.getByRole("combobox", { name: new RegExp(`^${label}，当前值：`) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("Toast bursts obey global capacity FIFO promotion bounded waiting and duplicate admission", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const preview = await previewFor(page);
  await freezeClock(page);
  const cards = page.locator(".ui-toast");
  const titles = cards.locator(".ui-toast__copy > strong");
  await expect(preview.getByRole("spinbutton", { name: "最多显示", exact: true })).toHaveValue("3");
  await expect(preview.getByRole("spinbutton", { name: "最多排队", exact: true })).toHaveValue("20");
  await launch(preview, "连续触发 10 条");
  await expect(cards).toHaveCount(3);
  await expect(titles).toHaveText(["排队提示 1/10", "排队提示 2/10", "排队提示 3/10"]);
  const initialBox = await bounds(cards.first());
  expect(initialBox.height).toBeGreaterThanOrEqual(58);
  expect(initialBox.width).toBeLessThanOrEqual(420);
  await page.screenshot({ path: test.info().outputPath("toast-default-capacity.png"), animations: "disabled" });

  // Waiting time must not consume a queued notification's visible lifetime.
  await page.clock.runFor(3100);
  await expect(cards.first().locator(".ui-toast__seconds")).toHaveText("1秒");
  await cards.first().getByRole("button", { name: "关闭通知：排队提示 1/10", exact: true }).click();
  await expect(titles).toHaveText(["排队提示 2/10", "排队提示 3/10", "排队提示 4/10"]);
  await expect(cards.last().locator(".ui-toast__seconds")).toHaveText("4秒");
  expect((await bounds(cards.last())).height).toBeCloseTo(initialBox.height, 0);
  for (let index = 2; index <= 10; index += 1) {
    await expect(cards).toHaveCount(Math.min(3, 11 - index));
    await cards.first().getByRole("button", { name: `关闭通知：排队提示 ${index}/10`, exact: true }).click();
  }
  await expect(cards).toHaveCount(0);

  // Three visible plus two waiting means the sixth and later burst items are ignored.
  await preview.getByRole("spinbutton", { name: "最多排队", exact: true }).fill("2");
  await launch(preview, "连续触发 10 条");
  for (let index = 1; index <= 5; index += 1) {
    await expect(cards).toHaveCount(Math.min(3, 6 - index));
    await cards.first().getByRole("button", { name: `关闭通知：排队提示 ${index}/10`, exact: true }).click();
  }
  await expect(cards).toHaveCount(0);
  for (let index = 0; index < 10; index += 1) await launch(preview, "重复触发同一提示");
  await expect(cards).toHaveCount(1);
  await cards.getByRole("button", { name: "关闭通知：同一操作重复点击只显示这条提示。", exact: true }).click();
  await expect(cards).toHaveCount(0);

  // Capacity covers every position together, rather than granting three cards per stack.
  await launch(preview, "异步操作提示");
  await launch(preview, "右下错误胶囊");
  await launch(preview, "居中成功提示");
  await launch(preview, "手动关闭提示");
  await expect(cards).toHaveCount(3);
  await expect(page.locator('.ui-toast[data-position="bottom-right"]')).toHaveCount(1);
  await expect(page.locator('.ui-toast[data-position="top-center"]')).toHaveCount(1);
  await launch(preview, "清空全部提示");
  await expect(cards).toHaveCount(0);
  await page.clock.runFor(5000);
  await expect(cards).toHaveCount(0);
});

test("Toast automatic seconds progress pause and manual dismissal remain independent", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const preview = await previewFor(page);
  await freezeClock(page);
  await choose(page, preview, "弹出位置", "顶部居中");
  await choose(page, preview, "提示形状", "胶囊");
  await preview.getByRole("spinbutton", { name: "持续时间（秒）", exact: true }).fill("6");
  await preview.getByRole("switch", { name: "显示读秒", exact: true }).setChecked(true);
  await preview.getByRole("switch", { name: "显示关闭按钮", exact: true }).setChecked(false);
  await launch(preview, "发送自定义提示");
  const card = page.locator(".ui-toast");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-shape", "pill");
  await expect(card).toHaveAttribute("data-position", "top-center");
  await expect(card.locator(".ui-toast__seconds")).toHaveText("6秒");
  await expect(card.locator(".ui-toast__seconds")).toHaveAttribute("aria-hidden", "true");
  await expect(card.locator(".ui-toast__countdown")).toHaveCount(0);
  await expect(card.locator(".ui-toast__close")).toHaveCount(0);
  const original = await bounds(card);
  expect(original.x + original.width / 2).toBeCloseTo(720, 0);
  await card.hover();
  await expect(card).toHaveAttribute("data-paused", "true");
  await page.clock.runFor(2500);
  await expect(card.locator(".ui-toast__seconds")).toHaveText("6秒");
  await page.mouse.move(0, 899);
  await expect(card).not.toHaveAttribute("data-paused", "true");
  await page.clock.runFor(2100);
  await expect(card.locator(".ui-toast__seconds")).toHaveText("4秒");
  const changed = await bounds(card);
  expect(changed.width).toBeCloseTo(original.width, 0);
  expect(changed.height).toBeCloseTo(original.height, 0);
  await page.clock.runFor(4000);
  await expect(card).toHaveCount(0);

  await preview.getByRole("switch", { name: "显示进度条", exact: true }).setChecked(true);
  await launch(preview, "发送自定义提示");
  await expect(card.locator(".ui-toast__countdown")).toBeVisible();
  await expect(card.locator(".ui-toast__seconds")).toHaveText("6秒");
  await card.hover();
  await page.clock.runFor(1000);
  await expect(card.locator(".ui-toast__seconds")).toHaveText("6秒");
  expect(await card.locator(".ui-toast__countdown > span").evaluate((node) => getComputedStyle(node).animationPlayState)).toBe("paused");
  await launch(preview, "清空全部提示");
  await expect(card).toHaveCount(0);

  await preview.getByRole("switch", { name: "自动关闭", exact: true }).setChecked(false);
  await expect(preview.getByRole("spinbutton", { name: "持续时间（秒）", exact: true })).toBeDisabled();
  await expect(preview.getByRole("switch", { name: "显示进度条", exact: true })).toBeDisabled();
  await expect(preview.getByRole("switch", { name: "显示读秒", exact: true })).toBeDisabled();
  await launch(preview, "发送自定义提示");
  await expect(card.locator(".ui-toast__seconds")).toHaveCount(0);
  await expect(card.locator(".ui-toast__countdown")).toHaveCount(0);
  // A persistent message with no action keeps an escape route despite closable:false.
  const fallbackClose = card.getByRole("button", { name: "关闭通知：设置已保存，相关成员将在下次登录时看到更新。", exact: true });
  await expect(fallbackClose).toBeVisible();
  await page.clock.runFor(10000);
  await expect(card).toHaveCount(1);
  await fallbackClose.click();
  await expect(card).toHaveCount(0);
});

test("Toast mobile long messages retain bounded readable bodies keyboard scrolling and visible closure", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const preview = await previewFor(page);
  await launch(preview, "长内容提示");
  const card = page.locator(".ui-toast");
  const body = card.getByRole("region", { name: "通知详情，可滚动阅读", exact: true });
  const close = card.getByRole("button", { name: "关闭通知：长内容通知", exact: true });
  await expect(body).toHaveAttribute("tabindex", "0");
  const dimensions = await body.evaluate((node) => ({
    width: node.clientWidth,
    scrollWidth: node.scrollWidth,
    height: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  expect(dimensions.height).toBeLessThanOrEqual(96);
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
  expect(dimensions.scrollWidth - dimensions.width).toBeLessThanOrEqual(1);
  const cardBox = await bounds(card);
  const closeBox = await bounds(close);
  expect(cardBox.height).toBeLessThanOrEqual(180);
  expect(cardBox.x).toBeGreaterThanOrEqual(11);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(309);
  expect(closeBox.x).toBeGreaterThan(cardBox.x);
  expect(closeBox.x + closeBox.width).toBeLessThan(cardBox.x + cardBox.width);
  expect(closeBox.y).toBeGreaterThanOrEqual(cardBox.y);
  expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.elementFromPoint(4, 24)?.closest(".ui-toast-viewport") == null)).toBe(true);
  await body.focus();
  await body.press("End");
  await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await body.press("Tab");
  await expect(close).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("toast-mobile-bounded-message.png"), animations: "disabled" });
  await close.press("Enter");
  await expect(card).toHaveCount(0);
});
