// @ui-coverage {"kind":"browser","runner":"browser","exports":["FilterBar","FilterField","Tag","ButtonGroup","IconButton"]}
import { expect, test } from "@playwright/test";

test("query actions match field corners and retain bounded desktop geometry while loading", async ({ page }) => {
  await page.goto("/#/components/filter-bar");
  await page.getByRole("tab", { name: "字段宽度与响应式预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "字段宽度与响应式预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const form = preview.getByRole("form", { name: "任务档案多字段筛选", exact: true });
  const button = form.getByRole("button", { name: "查询", exact: true });
  const input = form.getByRole("searchbox", { name: "任务编号", exact: true }).locator("..");
  const inputStyle = await input.evaluate(node => ({ radius: getComputedStyle(node).borderTopLeftRadius, height: node.getBoundingClientRect().height }));
  await expect(button).toHaveCSS("border-top-left-radius", inputStyle.radius);
  const idle = await button.boundingBox();
  expect(idle).not.toBeNull();
  expect(idle!.height).toBe(inputStyle.height);
  expect(idle!.width).toBeLessThan(120);
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");
  expect((await button.boundingBox())!.width).toBeCloseTo(idle!.width, 0);
  await expect(form.getByRole("status")).toContainText("已完成 1 次查询");
  await preview.screenshot({ path: test.info().outputPath("filter-rounded-actions.png"), animations: "disabled" });
});

test("business status tags remain readable and long compact labels truncate within a narrow host", async ({ page }) => {
  await page.route("https://flagcdn.com/**", route => route.abort());
  await page.goto("/#/components/tag", { waitUntil: "domcontentloaded" });
  const preview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const status = preview.locator('[data-ui-owner="Tag"]').filter({ hasText: /^排队中$/ });
  await expect(status).toHaveCSS("font-size", "13px");
  expect((await status.boundingBox())!.height).toBeGreaterThanOrEqual(26);
  await preview.screenshot({ path: test.info().outputPath("readable-status-tags.png"), animations: "disabled" });
  await page.getByRole("tab", { name: "长内容", exact: true }).click();
  const longPreview = page.getByRole("tabpanel", { name: "长内容", exact: true }).locator(".demo-explorer-preview");
  // Constrain only the consumer-owned preview, preserving canonical control styles.
  await longPreview.evaluate(node => { node.style.width = "180px"; node.style.maxWidth = "100%"; });
  const longTag = longPreview.locator('[data-ui-owner="Tag"]').first();
  await expect.poll(() => longTag.locator(".ui-tag__label").getAttribute("tabindex")).toBe("0");
  expect((await longTag.boundingBox())!.width).toBeLessThanOrEqual(180);
  await expect(longTag).toHaveAttribute("title", /全部产品中的角色配置/);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("120px button groups wrap fixed-size icons or scroll attached controls while Tab keeps focus visible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#/components/button-group");
  await page.getByRole("tab", { name: "长内容", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "长内容", exact: true }).locator(".demo-explorer-preview");
  const ordinary = preview.getByRole("group", { name: "窄容器普通操作", exact: true });
  const attached = preview.getByRole("group", { name: "窄容器连接操作", exact: true });
  const icons = ordinary.getByRole("button");
  await expect(icons).toHaveCount(4);
  const ordinaryBounds = (await ordinary.boundingBox())!;
  expect(ordinaryBounds.width).toBeLessThanOrEqual(120);
  expect(ordinaryBounds.height).toBeGreaterThan(36);
  for (const icon of await icons.all()) {
    const bounds = (await icon.boundingBox())!;
    expect(bounds.width).toBeCloseTo(36, 0);
    expect(bounds.height).toBeCloseTo(36, 0);
    expect(bounds.x).toBeGreaterThanOrEqual(ordinaryBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(ordinaryBounds.x + ordinaryBounds.width + 1);
  }
  await expect(attached).toHaveAttribute("tabindex", "0");
  expect(await attached.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  expect((await attached.boundingBox())!.width).toBeLessThanOrEqual(120);
  await attached.focus();
  const attachedIcons = attached.getByRole("button");
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press("Tab");
    const icon = attachedIcons.nth(index);
    await expect(icon).toBeFocused();
    await expect(icon).toHaveCSS("outline-style", "solid");
    await expect(icon).toHaveCSS("outline-offset", "-2px");
    await expect.poll(() => icon.evaluate(node => {
      const group = node.parentElement!.getBoundingClientRect();
      const bounds = node.getBoundingClientRect();
      return bounds.left >= group.left - 1 && bounds.right <= group.right + 1;
    }), { timeout: 2000 }).toBe(true);
    const groupBounds = (await attached.boundingBox())!;
    const bounds = (await icon.boundingBox())!;
    expect(bounds.width).toBeCloseTo(36, 0);
    expect(bounds.x).toBeGreaterThanOrEqual(groupBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(groupBounds.x + groupBounds.width + 1);
  }
  await attachedIcons.last().press("Enter");
  await expect(preview.getByRole("status")).toHaveText("已执行 1 次操作");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await preview.screenshot({ path: test.info().outputPath("bounded-button-groups-120.png"), animations: "disabled" });
});
