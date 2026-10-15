// @ui-coverage {"kind":"browser","runner":"browser","exports":["Dialog","Drawer"]}
import { expect, test, type Locator } from "@playwright/test";

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("long Dialog and Drawer descriptions scroll by keyboard while short screens retain title close body and footer", async ({ page }) => {
  for (const viewport of [{ width: 1024, height: 320 }, { width: 320, height: 400 }]) {
    await page.setViewportSize(viewport);
    for (const fixture of [
      { family: "dialog", trigger: "长内容弹窗", title: "项目配置详情", close: "关闭对话框", prefix: "ui-dialog" },
      { family: "drawer", trigger: "打开长内容详情", title: "完整成员资料", close: "关闭抽屉", prefix: "ui-drawer" },
    ]) {
      await page.goto(`/#/components/${fixture.family}`);
      await page.getByRole("tab", { name: "长内容", exact: true }).click();
      const preview = page.getByRole("tabpanel", { name: "长内容", exact: true }).locator(".demo-explorer-preview");
      await preview.getByRole("button", { name: fixture.trigger, exact: true }).click();
      const panel = page.getByRole("dialog", { name: fixture.title, exact: true });
      await expect(panel.locator("..")).toHaveAttribute("data-ui-motion", "open");
      const description = panel.locator(".ui-overlay-description");
      await expect(description).toHaveAttribute("tabindex", "0");
      const panelBox = await bounds(panel);
      const close = panel.getByRole("button", { name: fixture.close, exact: true });
      const footer = panel.getByRole("button", { name: "完成查看", exact: true });
      for (const node of [panel.getByRole("heading", { name: fixture.title, exact: true }), close, footer]) {
        const box = await bounds(node);
        expect(box.y).toBeGreaterThanOrEqual(panelBox.y - 1);
        expect(box.y + box.height).toBeLessThanOrEqual(panelBox.y + panelBox.height + 1);
      }
      const body = await bounds(panel.locator(`.${fixture.prefix}__body`));
      expect(body.height).toBeGreaterThan(44);
      expect(body.y + body.height).toBeLessThanOrEqual((await bounds(panel.locator(`.${fixture.prefix}__footer`))).y + 1);
      await close.focus();
      await close.press("Shift+Tab");
      await expect(description).toBeFocused();
      await description.press("End");
      await expect.poll(() => description.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await panel.screenshot({ path: test.info().outputPath(`${fixture.family}-${viewport.width}x${viewport.height}.png`), animations: "disabled" });
      await footer.click();
      await expect(panel).toBeHidden();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/components/dialog");
  await page.getByRole("tab", { name: "默认", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "默认", exact: true }).locator(".demo-explorer-preview");
  await preview.getByRole("button", { name: "编辑项目", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "编辑项目", exact: true }).locator(".ui-overlay-description")).not.toHaveAttribute("tabindex");
});
