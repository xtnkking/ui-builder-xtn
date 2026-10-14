// @ui-coverage {"kind":"browser","runner":"browser","exports":["ToastProvider","useToast"]}
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

interface CardMetric {
  id: number;
  top: number;
  left: number;
  width: number;
  height: number;
  state: string | null;
}
interface ScrollMetric {
  clientHeight: number;
  scrollHeight: number;
  clientWidth: number;
  scrollWidth: number;
  scrollTop: number;
  scrollbarHidden: boolean;
  gutterWidth: number;
  gutterHeight: number;
}
interface ViewportMetric extends ScrollMetric {
  position: string;
  top: number;
  height: number;
  maxHeight: number;
  minHeight: string;
  staticHeight: number;
  cards: CardMetric[];
  bodies: ScrollMetric[];
  animations: number;
}
interface ToastFrame { time: number; groups: ViewportMetric[] }
interface MotionResource { kind: "hold" | "movement"; connected: boolean; state: string }
declare global {
  interface Window {
    __toastScrollbar: {
      snapshot: () => ViewportMetric[];
      capture: (duration: number) => Promise<ToastFrame[]>;
      resources: () => MotionResource[];
    };
  }
}

const sourcePaths = [
  "src/ui/feedback/feedback.tsx", "src/ui/styles.css", "src/ui/internal/motion.ts",
  "src/explorer/cases/feedback/toast.case.tsx", "src/explorer/cases/foundation/motion.guide.tsx",
  "tests/browser/toast-scrollbar.spec.ts",
];
function sourceHashes() {
  return Object.fromEntries(sourcePaths.map((relative) => [relative,
    createHash("sha256").update(readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)))).digest("hex"),
  ]));
}
let startingHashes: Record<string, string>;

test.use({ viewport: { width: 686, height: 964 }, actionTimeout: 3_000, reducedMotion: "no-preference" });
test.describe("Toast scrollbar and bounded stack repair", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Focused Chromium regression; no additional engine matrix.");

  test.beforeEach(async ({ page }, info) => {
    startingHashes = sourceHashes();
    await info.attach("source-before.json", { body: JSON.stringify(startingHashes, null, 2), contentType: "application/json" });
    await page.addInitScript(() => {
      const keys = new WeakMap<Element, number>();
      let sequence = 0;
      const key = (node: Element) => {
        if (!keys.has(node)) keys.set(node, ++sequence);
        return keys.get(node)!;
      };
      const recorded: { kind: "hold" | "movement"; target: Element; animation: Animation }[] = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options);
        if (this.matches(".ui-toast-viewport,.ui-toast-slot")) {
          recorded.push({ kind: this.matches(".ui-toast-viewport") ? "hold" : "movement", target: this, animation });
        }
        return animation;
      };
      const scroll = (node: HTMLElement): ScrollMetric => {
        const css = getComputedStyle(node);
        const webkit = getComputedStyle(node, "::-webkit-scrollbar");
        return {
          clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
          clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, scrollTop: node.scrollTop,
          scrollbarHidden: css.getPropertyValue("scrollbar-width") === "none" || webkit.display === "none",
          gutterWidth: node.offsetWidth - node.clientWidth - parseFloat(css.borderLeftWidth) - parseFloat(css.borderRightWidth),
          gutterHeight: node.offsetHeight - node.clientHeight - parseFloat(css.borderTopWidth) - parseFloat(css.borderBottomWidth),
        };
      };
      const snapshot = (): ViewportMetric[] => Array.from(document.querySelectorAll<HTMLElement>(".ui-toast-viewport"), (node) => {
        const css = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const slots = Array.from(node.querySelectorAll<HTMLElement>(".ui-toast-slot"));
        return {
          ...scroll(node), position: node.className, top: rect.top, height: rect.height,
          maxHeight: parseFloat(css.maxHeight), minHeight: css.minHeight,
          staticHeight: slots.reduce((sum, slot) => sum + slot.getBoundingClientRect().height, 0)
            + Math.max(0, slots.length - 1) * parseFloat(css.rowGap) + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom),
          cards: Array.from(node.querySelectorAll<HTMLElement>(".ui-toast"), (card) => {
            const box = card.getBoundingClientRect();
            return { id: key(card), top: box.top, left: box.left, width: box.width, height: box.height, state: card.getAttribute("data-ui-motion") };
          }),
          bodies: Array.from(node.querySelectorAll<HTMLElement>(".ui-toast__description"), scroll),
          animations: node.getAnimations().filter((animation) => animation.playState === "running").length,
        };
      });
      window.__toastScrollbar = {
        snapshot,
        capture: async (duration) => {
          const start = performance.now();
          const frames: ToastFrame[] = [{ time: 0, groups: snapshot() }];
          while (performance.now() - start < duration) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            frames.push({ time: performance.now() - start, groups: snapshot() });
          }
          return frames;
        },
        resources: () => recorded.map(({ kind, target, animation }) => ({ kind, connected: target.isConnected, state: animation.playState })),
      };
    });
  });

  test.afterEach(async ({}, info) => {
    const finalHashes = sourceHashes();
    const stable = JSON.stringify(finalHashes) === JSON.stringify(startingHashes);
    const message = info.error?.message ?? "";
    const failureClass = info.status === "passed" ? null
      : /net::|browser.*closed|Target page.*closed|Executable doesn't exist/i.test(message) ? "infrastructure"
      : /strict mode violation|ReferenceError|SyntaxError|not a function/i.test(message) ? "tooling" : "product";
    await info.attach("source-after-and-classification.json", { body: JSON.stringify({ sourceHashes: finalHashes, stable,
      failureClass: stable ? failureClass : "evidence", status: info.status, message }, null, 2), contentType: "application/json" });
    expect(stable, "source must remain identical during this bounded acceptance").toBe(true);
  });

  test("two short toasts close without transformed false overflow and naturally shrink", async ({ page }, info) => {
    const preview = await overview(page, "motion");
    await clickNow(preview.getByRole("button", { name: "4 秒自动关闭", exact: true }));
    await clickNow(preview.getByRole("button", { name: "4 秒自动关闭", exact: true }));
    await ready(page, 2);
    await deleteAndCapture(page, info, 1);
  });

  test("eight short toasts support rapid consecutive deletion without a temporary scrollbar", async ({ page }, info) => {
    const preview = await overview(page);
    await seedEight(page, preview);
    await deleteAndCapture(page, info, 3);
  });

  test("bottom-right reverse stack closes and replaces slots along the actual screen direction", async ({ page }, info) => {
    const preview = await overview(page);
    await preview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
    await preview.getByRole("switch", { name: "自动关闭", exact: true }).uncheck();
    await preview.getByRole("combobox", { name: /^弹出位置/ }).click();
    await page.getByRole("option", { name: "右下角", exact: true }).click();
    for (let index = 0; index < 8; index++) await clickNow(preview.getByRole("button", { name: "发送自定义提示", exact: true }));
    await ready(page, 8);
    const evidence = await deleteAndCapture(page, info, 3);
    const oldCards = new Map(evidence.before[0].cards.map((card) => [card.id, card]));
    const survivors = evidence.after[0].cards;
    expect(survivors.every((card) => card.top > oldCards.get(card.id)!.top + 1), "closing the oldest bottom cards moves survivors down").toBe(true);
    const failures = evidence.frames.flatMap((frame) => frame.groups.flatMap((group) => group.cards.filter((card) => {
      const before = oldCards.get(card.id);
      const after = survivors.find((survivor) => survivor.id === card.id);
      return before && after && card.state === "open" && (card.top < Math.min(before.top, after.top) - 2 || card.top > Math.max(before.top, after.top) + 2);
    }).map((card) => ({ time: frame.time, card }))));
    expect(failures, "survivors must remain between their old and new screen positions").toEqual([]);

    // A paired top group can move its viewport without changing card height.
    // It needs the same visual-boundary protection as a shrinking stack.
    await clickNow(preview.getByRole("button", { name: "清空全部提示", exact: true }));
    await page.waitForFunction(() => !document.querySelector(".ui-toast"));
    await clickNow(preview.getByRole("button", { name: "多位置同时显示", exact: true }));
    await ready(page, 3);
    const pairedBefore = await snapshot(page);
    const pairedCapture = page.evaluate(() => window.__toastScrollbar.capture(800));
    await clickNow(page.locator(".ui-toast-viewport--top-center .ui-toast__close"));
    const pairedFrames = await pairedCapture;
    await ready(page, 2);
    await attach(info, "paired-top-removal-frames.json", { before: pairedBefore, frames: pairedFrames, after: await snapshot(page) });
    expect(pairedFrames.flatMap((frame) => frame.groups.filter((group) => group.staticHeight <= group.maxHeight + 1 && group.scrollHeight > group.clientHeight + 1))).toEqual([]);
    for (const frame of pairedFrames) {
      assertScrollbarsHidden(frame.groups);
      assertUnchangedCardSize(pairedBefore, frame.groups);
    }
  });

  test("320px real overflow stays scrollbar-free while wheel and Tab reach the last close button", async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 600 });
    const preview = await overview(page);
    await seedEight(page, preview);
    const before = await snapshot(page);
    expect(before).toHaveLength(1);
    const group = before[0];
    expect(group.staticHeight).toBeGreaterThan(group.maxHeight + 1);
    expect(group.scrollHeight).toBeGreaterThan(group.clientHeight + 1);
    assertScrollbarsHidden(before);
    assertCardsFit(before, 320);
    const viewport = page.locator(".ui-toast-viewport--top-right");
    const first = group.cards[0];
    await page.mouse.move(first.left + first.width / 2, first.top + first.height / 2);
    await page.mouse.wheel(0, 900);
    await page.waitForFunction(() => {
      const node = document.querySelector<HTMLElement>(".ui-toast-viewport--top-right");
      return node && node.scrollTop > 1 && node.scrollTop >= node.scrollHeight - node.clientHeight - 2;
    }, undefined, { timeout: 2_000 });
    const wheel = await snapshot(page);
    assertUnchangedCardSize(before, wheel);
    await info.attach("mobile-wheel-at-end.png", { body: await page.screenshot(), contentType: "image/png" });

    await viewport.evaluate((node) => { node.scrollTop = 0; });
    await viewport.locator(".ui-toast__close").first().focus();
    for (let index = 0; index < 7; index++) await page.keyboard.press("Tab");
    await expect(viewport.locator(".ui-toast__close").last()).toBeFocused();
    const keyboard = await snapshot(page);
    expect(keyboard[0].scrollTop).toBeGreaterThan(1);
    const visibleLast = await viewport.locator(".ui-toast__close").last().evaluate((button) => {
      const outer = button.closest(".ui-toast-viewport")!.getBoundingClientRect();
      const inner = button.getBoundingClientRect();
      return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    });
    expect(visibleLast).toBe(true);
    await page.keyboard.press("Enter");
    await ready(page, 7);
    const after = await snapshot(page);
    assertUnchangedCardSize(before, after);
    assertScrollbarsHidden(after);
    assertCardsFit(after, 320);
    await attach(info, "mobile-real-scroll-wheel-keyboard.json", { before, wheel, keyboard, after });
  });

  test("long toast text hides its scrollbar but native End exposes the final paragraph", async ({ page }, info) => {
    const preview = await overview(page);
    await clickNow(preview.getByRole("button", { name: "长内容提示", exact: true }));
    await ready(page, 1);
    const body = page.getByRole("region", { name: "通知详情，可滚动阅读", exact: true });
    await expect(body).toHaveAttribute("tabindex", "0");
    const before = await snapshot(page);
    expect(before[0].bodies[0].scrollHeight).toBeGreaterThan(before[0].bodies[0].clientHeight + 1);
    assertScrollbarsHidden(before);
    await body.focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() => {
      const node = document.querySelector<HTMLElement>(".ui-toast__description");
      return node && node.scrollTop > 1 && node.scrollTop >= node.scrollHeight - node.clientHeight - 2;
    }, undefined, { timeout: 2_000 });
    const tail = await body.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let last: Node | null = null;
      while (walker.nextNode()) last = walker.currentNode;
      if (!last) return { visible: false, text: "" };
      const range = document.createRange();
      range.setStart(last, Math.max(0, (last.textContent?.length ?? 0) - 5));
      range.setEnd(last, last.textContent?.length ?? 0);
      const rect = Array.from(range.getClientRects()).at(-1);
      const outer = node.getBoundingClientRect();
      return { text: node.textContent, visible: Boolean(rect && rect.top >= outer.top - 1 && rect.bottom <= outer.bottom + 1) };
    });
    expect(tail.text).toContain("8. 组织全部成员");
    expect(tail.visible).toBe(true);
    await attach(info, "long-text-native-end.json", { before, after: await snapshot(page), tail });
  });

  test("reduced motion and route unmount cancel active viewport height holds and naturally release space", async ({ page }, info) => {
    const preview = await overview(page);
    await seedEight(page, preview);
    await clickFirstCloseButtons(page, 3);
    await waitForActiveHold(page);
    const active = await page.evaluate(() => window.__toastScrollbar.resources());
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => window.__toastScrollbar.resources().every((animation) => animation.state !== "running"), undefined, { timeout: 2_000 });
    await ready(page, 5);
    const reduced = await snapshot(page);
    assertNaturalHeight(reduced);
    expect(reduced.every((group) => group.animations === 0)).toBe(true);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (let index = 0; index < 3; index++) await clickNow(preview.getByRole("button", { name: "手动关闭提示", exact: true }));
    await ready(page, 8);
    await clickFirstCloseButtons(page, 1);
    await waitForActiveHold(page);
    await page.evaluate(() => { window.location.hash = "/components/button"; });
    await expect(page.locator(".ui-toast")).toHaveCount(0);
    await page.waitForFunction(() => window.__toastScrollbar.resources().every((animation) => animation.state !== "running"), undefined, { timeout: 2_000 });
    const unmounted = await page.evaluate(() => window.__toastScrollbar.resources());
    expect(unmounted.some((animation) => animation.kind === "hold")).toBe(true);
    expect(unmounted.every((animation) => !animation.connected)).toBe(true);
    await attach(info, "reduced-and-unmounted-resources.json", { active, reduced, unmounted });
  });
});

async function overview(page: Page, component = "toast") {
  await page.goto(`/#/components/${component}`);
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
}
async function clickNow(button: Locator) { await button.evaluate((node) => (node as HTMLElement).click()); }
async function ready(page: Page, count: number) {
  await page.waitForFunction((count) => document.querySelectorAll('.ui-toast[data-ui-motion="open"]').length === count
    && document.querySelectorAll(".ui-toast").length === count, count, { timeout: 2_000 });
}
async function seedEight(page: Page, preview: Locator) {
  await preview.getByRole("spinbutton", { name: "最多显示", exact: true }).fill("8");
  for (let index = 0; index < 8; index++) await clickNow(preview.getByRole("button", { name: "手动关闭提示", exact: true }));
  await ready(page, 8);
}
async function clickFirstCloseButtons(page: Page, count: number) {
  await page.locator('.ui-toast[data-ui-motion="open"] .ui-toast__close').evaluateAll((buttons, count) => {
    buttons.slice(0, count).forEach((button) => (button as HTMLElement).click());
  }, count);
}
async function waitForActiveHold(page: Page) {
  await page.waitForFunction(() => window.__toastScrollbar.resources().some((animation) => animation.kind === "hold" && animation.state === "running"), undefined, { timeout: 2_000, polling: "raf" });
}
async function snapshot(page: Page) { return page.evaluate(() => window.__toastScrollbar.snapshot()); }
async function attach(info: TestInfo, name: string, value: unknown) {
  await info.attach(name, { body: JSON.stringify(value, null, 2), contentType: "application/json" });
}
function assertScrollbarsHidden(groups: ViewportMetric[]) {
  expect(groups.every((group) => group.scrollbarHidden && group.gutterWidth <= 1 && group.gutterHeight <= 1)).toBe(true);
  expect(groups.flatMap((group) => group.bodies).every((body) => body.scrollbarHidden && body.gutterWidth <= 1 && body.gutterHeight <= 1)).toBe(true);
}
function assertCardsFit(groups: ViewportMetric[], width: number) {
  expect(groups.every((group) => group.scrollWidth <= group.clientWidth + 1 && group.height <= group.maxHeight + 1)).toBe(true);
  expect(groups.flatMap((group) => group.cards).every((card) => card.left >= -1 && card.left + card.width <= width + 1)).toBe(true);
}
function assertNaturalHeight(groups: ViewportMetric[]) {
  expect(groups.every((group) => Number.isFinite(group.maxHeight)
    && Math.abs(group.height - Math.min(group.staticHeight, group.maxHeight)) <= 2)).toBe(true);
}
function assertUnchangedCardSize(before: ViewportMetric[], after: ViewportMetric[]) {
  const originals = new Map(before.flatMap((group) => group.cards).map((card) => [card.id, card]));
  expect(after.flatMap((group) => group.cards).every((card) => {
    const previous = originals.get(card.id);
    return previous && Math.abs(card.height - previous.height) <= 1 && Math.abs(card.width - previous.width) <= 1;
  })).toBe(true);
}
async function deleteAndCapture(page: Page, info: TestInfo, closeCount: number) {
  const before = await snapshot(page);
  expect(before).toHaveLength(1);
  expect(before[0].staticHeight).toBeLessThanOrEqual(before[0].maxHeight + 1);
  const capture = page.evaluate(() => window.__toastScrollbar.capture(800));
  await clickFirstCloseButtons(page, closeCount);
  const frames = await capture;
  await ready(page, before[0].cards.length - closeCount);
  const after = await snapshot(page);
  await attach(info, "toast-close-frame-evidence.json", { before, frames, after });
  expect(frames.length).toBeGreaterThanOrEqual(3);
  const falseOverflow = frames.flatMap((frame) => frame.groups.filter((group) =>
    group.staticHeight <= group.maxHeight + 1 && group.scrollHeight > group.clientHeight + 1,
  ).map((group) => ({ time: frame.time, group })));
  expect(falseOverflow, "short static content must not gain scrollable overflow from movement").toEqual([]);
  for (const frame of frames) {
    assertScrollbarsHidden(frame.groups);
    assertCardsFit(frame.groups, page.viewportSize()!.width);
    assertUnchangedCardSize(before, frame.groups);
  }
  expect(after[0].height).toBeLessThan(before[0].height - 1);
  assertNaturalHeight(after);
  expect(after[0].animations).toBe(0);
  return { before, frames, after };
}
