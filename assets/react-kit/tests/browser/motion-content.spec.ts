// @ui-coverage {"kind":"browser","runner":"browser","exports":["Tabs","SegmentedControl","Carousel","Lightbox"]}
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

interface FrameNode {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  running: number;
  motion: string | null;
}
interface Frame { time: number; nodes: FrameNode[] }

async function overview(page: Page) {
  await page.goto("/#/components/motion");
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
}

async function sample(page: Page, selector: string, duration = 420, clickSelectors: string[] = []): Promise<Frame[]> {
  return page.evaluate(async ({ selector, duration, clickSelectors }) => {
    const frames: Frame[] = [];
    const started = performance.now();
    const read = () => frames.push({ time: performance.now() - started, nodes: Array.from(document.querySelectorAll<HTMLElement>(selector), (node) => {
      const box = node.getBoundingClientRect();
      return {
        x: box.x, y: box.y, width: box.width, height: box.height, opacity: Number(getComputedStyle(node).opacity),
        running: node.getAnimations().filter((animation) => animation.playState === "running").length,
        motion: node.getAttribute("data-ui-selection-motion") ?? node.getAttribute("data-ui-content-motion"),
      };
    }) });
    read();
    const timers = clickSelectors.map((target, index) => window.setTimeout(() => {
      const button = document.querySelector<HTMLElement>(target);
      if (!button) throw new Error(`Missing statically reviewed action selector: ${target}`);
      button.click();
    }, index === 0 ? 0 : index * 60));
    while (performance.now() - started < duration) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      read();
    }
    timers.forEach((timer) => window.clearTimeout(timer));
    return frames;
  }, { selector, duration, clickSelectors });
}

async function evidence(info: TestInfo, name: string, frames: Frame[]) {
  await info.attach(name, { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
}

function assertTravel(frames: Frame[], from: number, to: number) {
  const visible = frames.flatMap((frame) => frame.nodes.map((node) => ({ time: frame.time, ...node })));
  expect(visible.length).toBeGreaterThan(4);
  expect(visible.some((node) => Math.abs(node.x - from) > 2 && Math.abs(node.x - to) > 2), "actual intermediate positions must be sampled").toBe(true);
  assertNoJump(frames, from, to);
}

function assertNoJump(frames: Frame[], from: number, to: number) {
  const visible = frames.flatMap((frame) => frame.nodes.map((node) => ({ time: frame.time, ...node })));
  expect(visible.every((node) => node.x >= Math.min(from, to) - 2 && node.x <= Math.max(from, to) + 2)).toBe(true);
  for (let index = 1; index < visible.length; index += 1) {
    const dt = visible[index].time - visible[index - 1].time;
    // A single-frame endpoint reset exceeds this bound; allow normal eased travel
    // and slower browser frames without assuming a fixed display refresh rate.
    expect(Math.abs(visible[index].x - visible[index - 1].x)).toBeLessThanOrEqual(Math.abs(to - from) * Math.min(1, dt / 120 + .22) + 2);
  }
}

async function aligned(indicator: Locator, selected: Locator) {
  const [mark, item] = await Promise.all([indicator.boundingBox(), selected.boundingBox()]);
  expect(mark).not.toBeNull();
  expect(item).not.toBeNull();
  expect(Math.abs(mark!.x - item!.x)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(mark!.width - item!.width)).toBeLessThanOrEqual(1.5);
}

test("Tabs indicator moves continuously, reverses quickly and realigns at320px", async ({ page }, info) => {
  const preview = await overview(page);
  const group = preview.getByRole("tablist", { name: "动效项目标签", exact: true });
  const selector = '[aria-label="动效项目标签"] .ui-tabs__indicator';
  const indicator = group.locator(".ui-tabs__indicator");
  await expect(group).toHaveAttribute("data-ui-selection-ready", "true");
  await aligned(indicator, group.getByRole("tab", { name: "项目概览", exact: true }));
  const from = (await indicator.boundingBox())!.x;
  const last = group.getByRole("tab", { name: "活动记录", exact: true });
  const to = (await last.boundingBox())!.x;
  const frames = await sample(page, selector, 420, ['[aria-label="动效项目标签"] button[title="活动记录"]']);
  await evidence(info, "tabs-continuous-positions.json", frames);
  assertTravel(frames, from, to);
  await aligned(indicator, last);
  const quick = await sample(page, selector, 480, ['[aria-label="动效项目标签"] button[title="项目概览"]', '[aria-label="动效项目标签"] button[title="活动记录"]', '[aria-label="动效项目标签"] button[title="团队成员"]']);
  await evidence(info, "tabs-rapid-reversal.json", quick);
  expect(quick.some((frame) => frame.nodes.some((node) => node.running > 0))).toBe(true);
  assertNoJump(quick, from, to);
  await expect(group.getByRole("tab", { name: "团队成员", exact: true })).toHaveAttribute("aria-selected", "true");
  await aligned(indicator, group.getByRole("tab", { name: "团队成员", exact: true }));
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await aligned(indicator, group.getByRole("tab", { name: "团队成员", exact: true }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("SegmentedControl keeps one moving background through rapid choices and320px resize", async ({ page }, info) => {
  const preview = await overview(page);
  const group = preview.getByRole("group", { name: "动效视图模式", exact: true });
  const selector = '[aria-label="动效视图模式"] .ui-segmented__indicator';
  const indicator = group.locator(".ui-segmented__indicator");
  await expect(group).toHaveAttribute("data-ui-selection-ready", "true");
  await expect(indicator).toHaveCount(1);
  await aligned(indicator, group.getByRole("button", { name: "列表视图", exact: true }));
  const from = (await indicator.boundingBox())!.x;
  const last = group.getByRole("button", { name: "日历视图", exact: true });
  const to = (await last.boundingBox())!.x;
  const frames = await sample(page, selector, 420, ['[aria-label="动效视图模式"] button[title="日历视图"]']);
  await evidence(info, "segmented-continuous-positions.json", frames);
  assertTravel(frames, from, to);
  await aligned(indicator, last);
  const quick = await sample(page, selector, 480, ['[aria-label="动效视图模式"] button[title="列表视图"]', '[aria-label="动效视图模式"] button[title="日历视图"]', '[aria-label="动效视图模式"] button[title="看板视图"]']);
  await evidence(info, "segmented-rapid-reversal.json", quick);
  expect(quick.some((frame) => frame.nodes.some((node) => node.running > 0))).toBe(true);
  assertNoJump(quick, from, to);
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await aligned(indicator, group.getByRole("button", { name: "看板视图", exact: true }));
  await page.setViewportSize({ width: 320, height: 780 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await aligned(indicator, group.getByRole("button", { name: "看板视图", exact: true }));
  await expect(indicator).toHaveCount(1);
});

test("Carousel changes one live slide with a real fade while preserving navigation focus", async ({ page }, info) => {
  const preview = await overview(page);
  const carousel = preview.getByRole("region", { name: "动效运营摘要", exact: true });
  const stage = carousel.locator(".ui-carousel__stage");
  const next = carousel.getByRole("button", { name: "下一项", exact: true });
  await next.focus();
  const capture = sample(page, '[aria-label="动效运营摘要"] .ui-carousel__stage');
  await next.press("Enter");
  const frames = await capture;
  await evidence(info, "carousel-content-fade.json", frames);
  expect(frames.some((frame) => frame.nodes.some((node) => node.opacity > .1 && node.opacity < .99))).toBe(true);
  await expect(stage).toHaveAttribute("aria-label", "2 / 3: 团队成员");
  await expect(stage).toHaveCSS("opacity", "1");
  await expect(carousel.locator('[aria-roledescription="slide"]')).toHaveCount(1);
  await expect(next).toBeFocused();
  await next.press("Enter");
  await carousel.getByRole("button", { name: "上一项", exact: true }).press("Enter");
  await expect(stage).toHaveAttribute("aria-label", "2 / 3: 团队成员");
  await expect(stage).toHaveCSS("opacity", "1");
});

test("Lightbox fades ready images while preserving one layer, keyboard and backdrop close", async ({ page }, info) => {
  const preview = await overview(page);
  const launch = preview.getByRole("button", { name: "预览两张风景", exact: true });
  await launch.click();
  const lightbox = page.getByRole("dialog", { name: "图片预览", exact: true });
  const original = await lightbox.elementHandle();
  await expect(lightbox.locator(".ui-lightbox__image")).toHaveAttribute("alt", "海岸蓝色风景");
  await expect(lightbox.locator(".ui-lightbox__image")).not.toHaveAttribute("data-loading", "true");
  const next = lightbox.getByRole("button", { name: "下一张", exact: true });
  await next.focus();
  const capture = sample(page, ".ui-lightbox > figure, .ui-lightbox__image");
  await next.press("Enter");
  const frames = await capture;
  await evidence(info, "lightbox-ready-image-fade.json", frames);
  expect(frames.some((frame) => frame.nodes.some((node) => node.opacity > .1 && node.opacity < .99))).toBe(true);
  await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("2 / 2");
  await expect(lightbox.locator(".ui-lightbox__image")).toHaveAttribute("alt", "森林绿色风景");
  await expect(next).toBeFocused();
  expect(await lightbox.evaluate((node, previous) => node === previous, original)).toBe(true);
  await expect(page.locator('[data-ui-owner="Lightbox"]')).toHaveCount(1);
  await page.keyboard.press("Home");
  await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("1 / 2");
  await page.keyboard.press("End");
  await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("2 / 2");
  const root = await lightbox.boundingBox();
  await page.mouse.click(root!.x + 6, root!.y + root!.height - 6);
  await expect(lightbox).toHaveCount(0);
  await expect(launch).toBeFocused();
});

test("Lightbox recovers from an actual decode error and ignores retired image events", async ({ page }, info) => {
  const preview = await overview(page);
  await preview.getByRole("button", { name: "预览失败与恢复", exact: true }).click();
  const lightbox = page.getByRole("dialog", { name: "图片预览", exact: true });
  await expect(lightbox.locator(".ui-lightbox__image-error")).toBeVisible();
  await lightbox.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(lightbox.locator(".ui-lightbox__image-error")).toHaveCount(0);
  const image = lightbox.locator(".ui-lightbox__image");
  await expect(image).toHaveAttribute("alt", "森林绿色风景");
  const retired = await image.elementHandle();
  await page.keyboard.press("Home");
  await expect(lightbox.locator(".ui-lightbox__image-error")).toBeVisible();
  // A retired successful DOM image may deliver a late load/error notification;
  // neither event may clear or replace the current failed image's status.
  await retired!.evaluate((node) => { node.dispatchEvent(new Event("load")); node.dispatchEvent(new Event("error")); });
  await expect(lightbox.locator(".ui-lightbox__image-error")).toBeVisible();
  await page.keyboard.press("End");
  await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("2 / 2");
  await expect(image).toHaveAttribute("alt", "森林绿色风景");
  await expect(lightbox.locator(".ui-lightbox__image-error")).toHaveCount(0);
  await evidence(info, "lightbox-error-recovery.json", await sample(page, ".ui-lightbox > figure, .ui-lightbox__image", 220));
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
});

test("real system reduced motion makes indicator and content changes immediate without running animations", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const preview = await overview(page);
  const frames = await sample(page, ".demo-explorer-preview .ui-tabs__indicator, .demo-explorer-preview .ui-segmented__indicator, .demo-explorer-preview .ui-carousel__stage", 250, [
    '[aria-label="动效项目标签"] button[title="活动记录"]',
    '[aria-label="动效视图模式"] button[title="日历视图"]',
    '[aria-label="动效运营摘要"] button[aria-label="下一项"]',
  ]);
  await evidence(info, "system-reduced-indicator-content.json", frames);
  expect(frames.every((frame) => frame.nodes.every((node) => node.running === 0 && node.opacity === 1))).toBe(true);
  await expect(preview.getByRole("tab", { name: "活动记录", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(preview.getByRole("button", { name: "日历视图", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.locator('[aria-label="动效运营摘要"] .ui-carousel__stage')).toHaveAttribute("aria-label", "2 / 3: 团队成员");
  await preview.getByRole("button", { name: "预览两张风景", exact: true }).click();
  const lightbox = page.getByRole("dialog", { name: "图片预览", exact: true });
  await expect(lightbox.locator(".ui-lightbox__image")).toHaveAttribute("alt", "海岸蓝色风景");
  const lightboxFrames = await sample(page, ".ui-lightbox, .ui-lightbox > figure, .ui-lightbox__image", 250, ['.ui-lightbox button[aria-label="下一张"]']);
  await evidence(info, "system-reduced-lightbox.json", lightboxFrames);
  expect(lightboxFrames.every((frame) => frame.nodes.every((node) => node.running === 0))).toBe(true);
  await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("2 / 2");
  await expect(lightbox.locator(".ui-lightbox__image")).toHaveAttribute("alt", "森林绿色风景");
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
});
