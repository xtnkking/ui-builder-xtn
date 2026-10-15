// @ui-coverage {"kind":"browser","runner":"browser","exports":["DataTable","ToastProvider"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function scenario(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "错误", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "错误", exact: true }).locator(".demo-explorer-preview");
  const table = preview.locator('[data-ui-owner="DataTable"]');
  await expect(table).toHaveCount(1);
  return { preview, table, frame: table.locator(".ui-data-table__frame") };
}

async function box(node: Locator) {
  return node.evaluate((element) => {
    const preview = element.closest(".demo-explorer-preview");
    if (!preview) throw new Error("Missing stable preview layout ancestor");
    const rect = element.getBoundingClientRect();
    return { y: rect.top - preview.getBoundingClientRect().top, height: rect.height };
  });
}

for (const width of [1440, 320]) {
  test(`table failures use one Toast without moving the frame and keep retry at ${width}px`, async ({ page }) => {
    const { preview, table, frame } = await scenario(page, width);
    const initial = await box(frame);
    for (const button of ["模拟首次加载失败", "模拟刷新失败"]) {
      await preview.getByRole("button", { name: button, exact: true }).click();
      await expect(table).toHaveAttribute("data-state", "loading");
      const pending = await box(frame);
      expect(Math.abs(pending.y - initial.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(pending.height - initial.height)).toBeLessThanOrEqual(1);
      await expect(table).toHaveAttribute("data-state", "error");
      const failed = await box(frame);
      expect(Math.abs(failed.y - initial.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(failed.height - initial.height)).toBeLessThanOrEqual(1);
      await expect(table.locator('[data-ui-owner="Alert"]')).toHaveCount(0);
      const toast = page.locator(".ui-toast");
      await expect(toast).toHaveCount(1);
      await expect(toast).toContainText("账户加载失败");
      if (button === "模拟刷新失败") {
        const data = width === 320 ? table.getByRole("list", { name: "账户错误反馈移动版" }) : table.getByRole("table", { name: "账户错误反馈" });
        await expect(data).toContainText("亚太区结算主账户");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await preview.screenshot({ path: test.info().outputPath(`${button === "模拟首次加载失败" ? "initial" : "cached"}-${width}.png`), animations: "disabled" });
      await toast.getByRole("button", { name: /关闭通知/ }).click();
      await expect(toast).toHaveCount(0);
      const retry = table.getByRole("button", { name: "重试", exact: true });
      await expect(retry).toHaveCount(1);
      await retry.focus();
      await retry.press("Enter");
      await expect(table).toHaveAttribute("aria-busy", "true");
      await expect(table).toHaveAttribute("data-state", "ready");
      expect(Math.abs((await box(frame)).height - initial.height)).toBeLessThanOrEqual(1);
    }
  });
}
