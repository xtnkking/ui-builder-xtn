// @ui-coverage {"kind":"browser","runner":"browser","exports":["Dialog","Drawer","ConfirmDialog","Lightbox","GuidedTour","ToastProvider","Select","SearchableSelect","Combobox","Autocomplete","AsyncSelect","MultiSelect","TreeSelect","DropdownMenu","ContextMenu","Popover","Tooltip","Collapse","ThemeProvider"]}
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

interface MotionSample {
  time: number;
  nodes: Array<{ state: string | null; opacity: number; transform: string; translateX: number; translateY: number; x: number; y: number; width: number; height: number }>;
}

test.setTimeout(30_000);
test.use({ viewport: { width: 1440, height: 1100 }, actionTimeout: 5_000, reducedMotion: "no-preference" });

async function overview(page: Page, component = "motion") {
  await page.goto(`/#/components/${component}`);
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  return page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
}

async function samples(page: Page, selector: string, duration = 450): Promise<MotionSample[]> {
  return page.evaluate(async ({ selector, duration }) => {
    const result: MotionSample[] = [];
    const start = performance.now();
    while (performance.now() - start < duration) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      result.push({ time: performance.now() - start, nodes: Array.from(document.querySelectorAll<HTMLElement>(selector), (node) => {
        const rect = node.getBoundingClientRect();
        const css = getComputedStyle(node);
        const matrix = css.transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(css.transform);
        return { state: node.dataset.uiMotion ?? node.closest<HTMLElement>("[data-ui-motion]")?.dataset.uiMotion ?? null, opacity: Number(css.opacity), transform: css.transform, translateX: matrix.m41, translateY: matrix.m42, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }) });
    }
    return result;
  }, { selector, duration });
}

async function attach(info: TestInfo, name: string, frames: MotionSample[]) {
  await info.attach(name, { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
}

async function scopedAxe(page: Page, info: TestInfo, name: string, selectors: string[]) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);
  for (const selector of selectors) builder = builder.include(selector);
  const result = await builder.analyze();
  await info.attach(name, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  expect(result.passes.length + result.violations.length + result.incomplete.length).toBeGreaterThan(0);
  expect(result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target) }))).toEqual([]);
}

async function clickNow(button: Locator) {
  await button.evaluate((node) => (node as HTMLElement).click());
}

async function assertExit(panel: Locator) {
  // One browser read observes a short exit atomically instead of spending its lifetime
  // on three independent locator/expect round trips.
  const state = await panel.evaluate((node) => ({
    state: node.getAttribute("data-ui-motion"),
    inert: node.hasAttribute("inert"),
    ariaHidden: node.getAttribute("aria-hidden"),
  }));
  expect(state).toEqual({ state: "exiting", inert: true, ariaHidden: "true" });
  await expect(panel).toHaveCount(0, { timeout: 1000 });
}

async function assertWithin(panel: Locator, width: number) {
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
}

test.describe("motion Chromium affected scenarios", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Primary visual and component-family sampling runs only in Chromium.");

  test("drawer keeps desktop edges and mobile bottom direction through a real entrance and exit", async ({ page }, info) => {
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 780 });
      const preview = await overview(page);
      const launch = preview.getByRole("button", { name: "打开抽屉", exact: true });
      const capture = samples(page, '.ui-overlay--drawer, [data-ui-owner="Drawer"]');
      await launch.click();
      const drawer = page.getByRole("dialog", { name: "抽屉动效演示", exact: true });
      await expect(drawer).toBeVisible();
      const frames = await capture;
      await attach(info, `drawer-${width}-entrance.json`, frames);
      expect(frames.some((frame) => frame.nodes.some((node) => node.transform !== "none"))).toBe(true);
      await expect(page.locator(".ui-overlay--drawer")).toHaveAttribute("data-ui-motion", "open");
      await assertWithin(drawer, width);
      const rect = await drawer.boundingBox();
      expect(rect!.x + rect!.width).toBeCloseTo(width, 0);
      expect(rect!.y + rect!.height).toBeCloseTo(780, 0);
      if (width === 1440) expect(rect!.y).toBeCloseTo(0, 0);
      else expect(rect!.y).toBeGreaterThan(0);
      if (width === 1440) await scopedAxe(page, info, "axe-drawer-open.json", ['[data-ui-owner="Drawer"]']);

      const originalDrawer = await drawer.elementHandle();
      const reversalCapture = samples(page, '.ui-overlay--drawer, [data-ui-owner="Drawer"]', 500);
      await clickNow(drawer.getByRole("button", { name: "抽屉退出中重开", exact: true }));
      const reversal = await reversalCapture;
      await attach(info, `drawer-${width}-exit-reopen-continuity.json`, reversal);
      const reversalIndex = reversal.findIndex((frame, index) => index > 0
        && frame.nodes[0]?.state === "entering"
        && reversal[index - 1].nodes[0]?.state === "exiting");
      expect(reversalIndex, "the actual close-to-reopen boundary must be sampled").toBeGreaterThan(0);
      const before = reversal[reversalIndex - 1];
      const after = reversal[reversalIndex];
      const delta = after.time - before.time;
      // Allow normal per-frame travel; resetting to the off-screen starting point
      // would jump most of the drawer's size and fail this bound.
      const travel = width === 320 ? "translateY" : "translateX";
      const dimension = width === 320 ? rect!.height : rect!.width;
      expect(Math.abs(after.nodes[1][travel] - before.nodes[1][travel])).toBeLessThanOrEqual(dimension * Math.min(.35, delta / 180 + .12) + 1);
      expect(Math.abs(after.nodes[0].opacity - before.nodes[0].opacity)).toBeLessThanOrEqual(Math.min(.45, delta / 140 + .12));
      await expect(page.locator(".ui-overlay--drawer")).toHaveAttribute("data-ui-motion", "open");
      expect(await drawer.evaluate((node, original) => node === original, originalDrawer)).toBe(true);
      expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

      const exitCapture = samples(page, '.ui-overlay--drawer, [data-ui-owner="Drawer"]');
      await clickNow(drawer.getByRole("button", { name: "完成并关闭", exact: true }));
      await expect(page.locator(".ui-overlay--drawer")).toHaveAttribute("data-ui-motion", "exiting");
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      await attach(info, `drawer-${width}-exit.json`, await exitCapture);
      await expect(drawer).toHaveCount(0);
      await expect(launch).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  });

  test("Toast retains capacity during exit, promotes FIFO and pauses actual countdown", async ({ page }, info) => {
    const preview = await overview(page);
    await preview.getByRole("button", { name: "连续加入 5 条", exact: true }).press("Enter");
    const cards = page.locator(".ui-toast");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("队列中的第 1 条消息");
    await expect(cards.nth(1)).toContainText("队列中的第 2 条消息");
    await expect(cards.first()).toHaveAttribute("data-ui-motion", "open");
    // Public pause behavior keeps the two timed items stable during the scoped scan.
    await cards.first().hover();
    await cards.nth(1).getByRole("button", { name: /关闭通知/ }).focus();
    await expect(cards.nth(0)).toHaveAttribute("data-paused", "true");
    await expect(cards.nth(1)).toHaveAttribute("data-paused", "true");
    await scopedAxe(page, info, "axe-toast-open.json", [".ui-toast"]);
    await page.mouse.move(0, 1090);
    const first = cards.first();
    const capture = samples(page, ".ui-toast");
    await clickNow(first.getByRole("button", { name: /关闭通知/ }));
    await expect(first).toHaveAttribute("data-ui-motion", "exiting");
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: "队列中的第 3 条消息" })).toHaveCount(0);
    await attach(info, "toast-queue-exit-and-promotion.json", await capture);
    await expect(cards.nth(0)).toContainText("队列中的第 2 条消息");
    await expect(cards.nth(1)).toContainText("队列中的第 3 条消息");
    await preview.getByRole("button", { name: "清空全部提示", exact: true }).press("Enter");
    await expect(cards).toHaveCount(0);

    await preview.getByRole("button", { name: "4 秒自动关闭", exact: true }).press("Enter");
    await cards.hover();
    await expect(cards).toHaveAttribute("data-paused", "true");
    const seconds = await cards.locator(".ui-toast__seconds").textContent();
    await page.waitForTimeout(1100);
    await expect(cards.locator(".ui-toast__seconds")).toHaveText(seconds!);
    await page.mouse.move(0, 1090);
    await expect(cards).not.toHaveAttribute("data-paused", "true");
    await expect(cards).toHaveCount(0, { timeout: 5000 });
  });

  test("320px three-position Toast geometry stays separated before, during and after exit", async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 780 });
    const preview = await overview(page, "toast");
    const capture = samples(page, ".ui-toast", 550);
    await preview.getByRole("button", { name: "多位置同时显示", exact: true }).press("Enter");
    const cards = page.locator(".ui-toast");
    await expect(cards).toHaveCount(3);
    const frames = await capture;
    await attach(info, "toast-three-positions-320.json", frames);
    expect(frames.some((frame) => frame.nodes.length === 3)).toBe(true);
    for (const frame of frames.filter((item) => item.nodes.length === 3)) {
      for (const box of frame.nodes) {
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(321);
      }
      const ordered = [...frame.nodes].sort((a, b) => a.y - b.y);
      for (let index = 1; index < ordered.length; index += 1) expect(ordered[index].y).toBeGreaterThanOrEqual(ordered[index - 1].y + ordered[index - 1].height - 1);
    }
    await page.screenshot({ path: info.outputPath("toast-three-positions-320.png"), animations: "allow" });
    await cards.first().getByRole("button", { name: /关闭通知/ }).press("Enter");
    await expect(cards).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await preview.getByRole("button", { name: "清空全部提示", exact: true }).press("Enter");
    await expect(cards).toHaveCount(0);
  });

  test("all seven input menu branches retain a noninteractive exit without positioning drift", async ({ page }, info) => {
    const cases = [
      ["select", "#explorer-select", ".ui-select__popover"],
      ["select", "#explorer-searchable-select", ".ui-combobox__popover"],
      ["select", "#explorer-async-select", ".ui-async-select__popover"],
      ["combobox", "#explorer-combobox", ".ui-combobox__popover"],
      ["combobox", "#explorer-autocomplete", ".ui-autocomplete__list"],
      ["multi-select", "#explorer-multi-select", ".ui-multi-select__popover"],
      ["tree-select", "#explorer-tree-select", ".ui-tree-select__tree"],
    ];
    for (const [route, triggerSelector, popupSelector] of cases) {
      await overview(page, route);
      const trigger = page.locator(triggerSelector);
      await trigger.click();
      const popup = page.locator(popupSelector);
      await expect(popup).toHaveAttribute("data-positioned", "true");
      await expect(popup).toHaveAttribute("data-ui-motion", "open");
      await assertWithin(popup, 1440);
      expect(await popup.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
      if (triggerSelector === "#explorer-async-select") {
        await popup.locator("input").fill("loading");
        await expect(popup.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
        await popup.locator("input").fill("");
        await expect(popup.getByRole("listbox")).not.toHaveAttribute("aria-busy", "true");
      }
      const before = await popup.boundingBox();
      const capture = samples(page, popupSelector, 300);
      await page.keyboard.press("Escape");
      await assertExit(popup);
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).not.toHaveAttribute("aria-controls");
      const frames = await capture;
      await attach(info, `${triggerSelector.slice(1)}-exit.json`, frames);
      for (const frame of frames) for (const box of frame.nodes) {
        expect(Math.abs(box.x - before!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.width - before!.width)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("Dropdown, ContextMenu, Popover and Tooltip fade out with their keyboard contracts intact", async ({ page }, info) => {
    let preview = await overview(page, "menu");
    await preview.getByRole("button", { name: "下拉菜单", exact: true }).click();
    let popup = page.locator(".ui-dropdown__menu");
    await expect(popup).toHaveAttribute("data-ui-motion", "open");
    await page.keyboard.press("Escape");
    await assertExit(popup);
    const context = preview.locator('[data-ui-owner="ContextMenu"]');
    await context.focus();
    await context.press("Shift+F10");
    popup = page.locator(".ui-context-menu__surface");
    await expect(popup).toHaveAttribute("data-ui-motion", "open");
    await assertWithin(popup, 1440);
    await page.keyboard.press("Escape");
    await assertExit(popup);
    await expect(context).toBeFocused();

    preview = await overview(page, "popover");
    await preview.getByRole("button", { name: "筛选摘要", exact: true }).click();
    popup = page.locator(".ui-popover__surface");
    await expect(popup).toHaveAttribute("data-ui-motion", "open");
    await popup.getByRole("button", { name: "完成", exact: true }).focus();
    await page.keyboard.press("Escape");
    await assertExit(popup);
    await expect(preview.getByRole("button", { name: "筛选摘要", exact: true })).toBeFocused();

    preview = await overview(page, "tooltip");
    const tooltipTrigger = preview.getByRole("button", { name: "悬停或聚焦", exact: true });
    await tooltipTrigger.hover();
    popup = page.locator(".ui-tooltip__bubble");
    await expect(popup).toHaveAttribute("data-ui-motion", "open");
    const capture = samples(page, ".ui-tooltip__bubble", 300);
    await page.mouse.move(0, 1090);
    await expect(popup).toHaveAttribute("data-ui-motion", "exiting");
    expect(await popup.evaluate((node) => getComputedStyle(node).display)).not.toBe("none");
    await expect(popup).toHaveAttribute("data-ui-motion", "closed", { timeout: 1000 });
    await expect(popup).toBeHidden();
    await attach(info, "tooltip-real-exit.json", await capture);
  });

  test("Collapse keeps natural dynamic height, reverses in flight and hands hidden focus back", async ({ page }, info) => {
    const preview = await overview(page);
    const collapse = preview.locator('[data-ui-owner="Collapse"]');
    const panel = collapse.locator(".ui-collapse__panel");
    await expect(panel).toHaveAttribute("data-ui-motion", "open");
    const initial = await panel.boundingBox();
    await preview.getByRole("button", { name: "追加一段内容", exact: true }).click();
    await expect(panel.locator("p")).toHaveCount(2);
    expect((await panel.boundingBox())!.height).toBeGreaterThan(initial!.height);
    const capture = samples(page, ".ui-collapse__panel", 500);
    await clickNow(preview.getByRole("button", { name: "收起内容", exact: true }));
    await expect(panel).toHaveAttribute("aria-hidden", "true");
    await clickNow(preview.getByRole("button", { name: "展开内容", exact: true }));
    await expect(collapse.locator(".ui-collapse__trigger")).toHaveAttribute("aria-expanded", "true");
    const frames = await capture;
    await attach(info, "collapse-reversal-and-dynamic-height.json", frames);
    await expect(panel).toHaveAttribute("data-ui-motion", "open");
    const geometry = await panel.evaluate((node) => ({ client: node.clientHeight, scroll: node.scrollHeight, inlineHeight: node.style.height }));
    expect(geometry.scroll - geometry.client).toBeLessThanOrEqual(1);
    expect(geometry.inlineHeight).toBe("");
    await panel.getByRole("button", { name: "从内容内收起并回焦", exact: true }).click();
    await expect(collapse.locator(".ui-collapse__trigger")).toBeFocused();
    await expect(panel).toBeHidden();
  });

  test("live reduced-motion changes finish exits immediately while feedback time still advances", async ({ page }, info) => {
    const preview = await overview(page);
    await preview.getByRole("button", { name: "打开弹窗", exact: true }).click();
    await expect(page.locator(".ui-overlay")).toHaveAttribute("data-ui-motion", "open");
    const capture = samples(page, ".ui-overlay, .ui-dialog", 250);
    await clickNow(page.getByRole("button", { name: "关闭弹窗", exact: true }));
    await expect(page.locator(".ui-overlay")).toHaveAttribute("data-ui-motion", "exiting");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".ui-overlay")).toHaveCount(0, { timeout: 200 });
    await attach(info, "reduced-motion-during-exit.json", await capture);
    await expect(preview.getByText(/已开启，位移与展开过渡停用/)).toBeVisible();
    await preview.getByRole("button", { name: "运行加载演示", exact: true }).click();
    await expect(preview.getByRole("button", { name: "演示中", exact: true }).locator(".ui-spinner")).toHaveCSS("animation-name", "none");
    await expect(preview.getByText("示例任务已完成", { exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "4 秒自动关闭", exact: true }).press("Enter");
    await expect(page.locator(".ui-toast")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".ui-toast__seconds")).toHaveText("4秒");
    await page.mouse.move(0, 1090);
    await expect(page.locator(".ui-toast")).toHaveCount(0, { timeout: 5000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(preview.getByText(/未开启，使用默认轻动效/)).toBeVisible();
  });

  test("modal extensions still navigate and Apple glass nested portals inherit material during motion", async ({ page }, info) => {
    let preview = await overview(page, "dialog");
    await preview.getByRole("button", { name: "删除项目", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "删除项目", exact: true });
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    preview = await overview(page, "lightbox");
    await preview.getByRole("button", { name: "预览图片", exact: true }).click();
    const lightbox = page.locator('[data-ui-owner="Lightbox"]');
    await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("1 / 2");
    await lightbox.getByRole("button", { name: "下一张", exact: true }).click();
    await expect(lightbox.locator(".ui-lightbox__position")).toHaveText("2 / 2");
    await lightbox.getByRole("button", { name: "关闭预览", exact: true }).click();
    await expect(lightbox).toHaveCount(0);

    preview = await overview(page, "tour");
    await preview.getByRole("button", { name: "开始引导", exact: true }).click();
    const tour = page.getByRole("dialog", { name: "功能引导", exact: true });
    await tour.getByRole("button", { name: "下一步", exact: true }).click();
    await expect(tour).toContainText("稳定回退");
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);

    await page.goto("/#/themes");
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    const capture = samples(page, ".ui-overlay, .ui-dialog, .ui-select__popover", 500);
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "新建团队项目", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox", { name: /^项目负责人/ }).click();
    const menu = page.getByRole("listbox", { name: "项目负责人", exact: true });
    await expect(menu).toHaveAttribute("data-theme-preset", "apple");
    await expect(menu).toHaveAttribute("data-theme-material", "glass");
    await expect(menu).toHaveAttribute("data-color-scheme", "dark");
    await expect(menu).toHaveAttribute("data-ui-motion", "open");
    await scopedAxe(page, info, "axe-nested-apple-dialog-menu.json", ['[data-ui-owner="Dialog"]', ".ui-select__popover"]);
    await attach(info, "apple-glass-dark-nested-portal.json", await capture);
    await page.screenshot({ path: info.outputPath("apple-glass-dark-nested-portal.png"), animations: "allow" });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("motion cross-engine core", () => {
  test("modal exit reversal preserves one layer, focus trap and final scroll restoration", async ({ page }, info) => {
    const preview = await overview(page);
    const launch = preview.getByRole("button", { name: "打开弹窗", exact: true });
    const capture = samples(page, ".ui-overlay, .ui-dialog", 550);
    await launch.click();
    const dialog = page.getByRole("dialog", { name: "弹窗动效演示", exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.locator(".ui-overlay")).toHaveAttribute("data-ui-motion", "open");
    const original = await dialog.elementHandle();
    await clickNow(dialog.getByRole("button", { name: "退出中重开", exact: true }));
    await expect(page.locator(".ui-overlay")).toHaveAttribute("data-ui-motion", "exiting");
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await expect(page.locator(".ui-overlay")).toHaveAttribute("data-ui-motion", "open");
    expect(await dialog.evaluate((node, previous) => node === previous, original)).toBe(true);
    await expect(page.locator(".ui-overlay")).toHaveCount(1);
    for (const key of ["Tab", "Tab", "Shift+Tab"]) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await attach(info, "cross-engine-modal-entrance-reversal.json", await capture);
    const exitCapture = samples(page, ".ui-overlay, .ui-dialog", 350);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0, { timeout: 1000 });
    await attach(info, "cross-engine-modal-final-exit.json", await exitCapture);
    await expect(launch).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    expect(await page.evaluate(() => document.querySelectorAll("[inert]").length)).toBe(0);
  });

  test("floating menu and Collapse settle at natural geometry and clean up closed interaction", async ({ page }, info) => {
    const preview = await overview(page);
    const trigger = preview.getByRole("combobox", { name: /^选择演示模式/ });
    const capture = samples(page, ".ui-select__popover, .ui-collapse__panel", 500);
    await trigger.click();
    const menu = page.getByRole("listbox", { name: "选择演示模式", exact: true });
    await expect(menu).toHaveAttribute("data-ui-motion", "open");
    await assertWithin(menu, 1440);
    const before = await menu.boundingBox();
    expect(await menu.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
    await page.keyboard.press("Escape");
    await assertExit(page.locator(".ui-select__popover"));
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(menu).toHaveAttribute("data-ui-motion", "open");
    const after = await menu.boundingBox();
    expect(Math.abs(before!.width - after!.width)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await preview.getByRole("button", { name: "收起内容", exact: true }).click();
    const panel = preview.locator(".ui-collapse__panel");
    await expect(panel).toBeHidden();
    await preview.getByRole("button", { name: "展开内容", exact: true }).click();
    await expect(panel).toHaveAttribute("data-ui-motion", "open");
    expect(await panel.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
    await attach(info, "cross-engine-floating-collapse.json", await capture);
  });
});
