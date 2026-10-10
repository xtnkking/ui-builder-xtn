import { expect, test, type Locator } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

async function expectUnclippedButtonLabel(button: Locator, expectedHeight: number, loading = false) {
  await expect(button).toBeVisible();
  const labelSelector = loading ? ".pui-button__loading > span:last-child" : ".pui-button__label";
  await expect(button.locator(labelSelector)).toBeVisible();
  const metrics = await button.evaluate((element, selector) => {
    const label = element.querySelector<HTMLElement>(selector)!;
    const style = getComputedStyle(label);
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect();
    const clipping = [];
    for (let node: HTMLElement | null = label; node; node = node.parentElement) {
      const nodeStyle = getComputedStyle(node);
      const clipsX = /^(hidden|clip|auto|scroll)$/.test(nodeStyle.overflowX);
      const clipsY = /^(hidden|clip|auto|scroll)$/.test(nodeStyle.overflowY);
      if (clipsX || clipsY) {
        const rect = node.getBoundingClientRect();
        clipping.push({
          className: node.className,
          clipsX,
          clipsY,
          left: rect.left + node.clientLeft,
          right: rect.left + node.clientLeft + node.clientWidth,
          top: rect.top + node.clientTop,
          bottom: rect.top + node.clientTop + node.clientHeight,
        });
      }
      if (node === element) break;
    }
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      height: element.getBoundingClientRect().height,
      text: { left: text.left, right: text.right, top: text.top, bottom: text.bottom, width: text.width, height: text.height },
      clipping,
    };
  }, labelSelector);

  expect(metrics.lineHeight, "Chinese labels need room for the font's glyph metrics").toBeGreaterThanOrEqual(metrics.fontSize * 1.4);
  expect(metrics.text.width).toBeGreaterThan(0);
  expect(metrics.text.height).toBeGreaterThan(0);
  expect(metrics.height).toBeGreaterThanOrEqual(expectedHeight - 0.5);
  expect(metrics.height).toBeLessThanOrEqual(expectedHeight + 0.5);
  for (const clip of metrics.clipping) {
    if (clip.clipsX) {
      expect(metrics.text.left, `${clip.className}: text starts inside the horizontal clip`).toBeGreaterThanOrEqual(clip.left - 0.5);
      expect(metrics.text.right, `${clip.className}: text ends inside the horizontal clip`).toBeLessThanOrEqual(clip.right + 0.5);
    }
    if (clip.clipsY) {
      expect(metrics.text.top, `${clip.className}: text starts inside the vertical clip`).toBeGreaterThanOrEqual(clip.top - 0.5);
      expect(metrics.text.bottom, `${clip.className}: text ends inside the vertical clip`).toBeLessThanOrEqual(clip.bottom + 0.5);
    }
  }
  return metrics.height;
}

test("keeps Chinese default, disabled, loading and small Button labels unclipped without growing controls", async ({ page }) => {
  await page.goto("/#/components/button");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const heights: number[] = [];
  for (const example of [
    { state: "default", tab: "默认", label: "保存更改" },
    { state: "disabled", tab: "禁用", label: "不可用" },
    { state: "loading", tab: "加载中", label: "保存中" },
  ] as const) {
    const tab = page.getByRole("tab", { name: example.tab, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const preview = page.locator(`[data-state-example="${example.state}"] .demo-explorer-preview`);
    const button = preview.getByRole("button", { name: example.label, exact: true });
    if (example.state === "disabled") await expect(button).toBeDisabled();
    if (example.state === "loading") await expect(button).toHaveAttribute("aria-busy", "true");
    heights.push(await expectUnclippedButtonLabel(button, 38, example.state === "loading"));
  }
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(0.5);

  // This real Tag fixture renders a public size="small" Button after removing its tag.
  await page.goto("/#/components/tag");
  const tagPreview = page.locator(".demo-explorer-preview");
  await tagPreview.getByRole("button", { name: "移除即将过期标签", exact: true }).click();
  const small = tagPreview.getByRole("button", { name: "恢复标签", exact: true });
  await expect(small).toHaveClass(/\bpui-button--small\b/);
  await expectUnclippedButtonLabel(small, 32);
});

test("clips the dark Divider preview to the shared surface radius", async ({ page }) => {
  await page.goto("/#/components/divider");
  await page.getByRole("tab", { name: "深色模式", exact: true }).click();
  const host = page.locator('[data-state-example="dark"] .demo-state-preview');
  await expect(host).toBeVisible();
  await expect(host.getByRole("separator")).toBeVisible();
  const style = await host.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      corners: [computed.borderTopLeftRadius, computed.borderTopRightRadius, computed.borderBottomLeftRadius, computed.borderBottomRightRadius],
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
    };
  });
  expect(style.corners).toEqual(["8px", "8px", "8px", "8px"]);
  expect(style.overflowX).toBe("clip");
  expect(style.overflowY).toBe("clip");
});

test("shows runnable previews instead of missing or pending placeholders for all nine foundation routes", async ({ page }) => {
  for (const id of ["typography", "spacing", "radius", "surface", "icons", "motion", "z-index", "density", "focus"]) {
    await test.step(id, async () => {
      await page.goto(`/#/components/${id}`);
      await expect(page).toHaveURL(new RegExp(`/#/components/${id}$`));
      const main = page.getByRole("main");
      await expect(main.locator('[data-example-status="runnable"]')).toBeVisible();
      await expect(main.locator('[data-example-status="missing"], [data-state-coverage="pending"]')).toHaveCount(0);
      const preview = main.locator(".demo-explorer-preview");
      await expect(preview).toHaveCount(1);
      await expect(preview).toBeVisible();
      await expect(preview.locator("[data-pui-owner]").first()).toBeVisible();
    });
  }
});
