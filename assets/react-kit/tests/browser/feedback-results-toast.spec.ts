// @ui-coverage {"kind":"browser","runner":"browser","exports":["AuthenticationPage","ConfirmDialog","Banner","ToastProvider"]}
import { expect, test } from "@playwright/test";

test.setTimeout(30_000);

test("storefront login failure uses one Toast and retains inputs for retry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/examples/shop/login");
  const authentication = page.locator(".business-auth-root");
  await authentication.getByRole("button", { name: "体验账号与登录帮助", exact: true }).click();
  await authentication.getByRole("button", { name: "填入演示账号", exact: true }).click();
  await authentication.getByRole("checkbox", { name: "下一次提交模拟服务异常（之后可重试）", exact: true }).check();
  const form = authentication.locator("form");
  await form.getByRole("button", { name: "登录", exact: true }).click();
  const notice = page.locator(".ui-toast");
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText("登录未完成");
  await expect(authentication.locator('[data-ui-owner="Alert"]')).toHaveCount(0);
  await expect(authentication.getByLabel(/^邮箱/)).toHaveValue("demo@qingyu.example");
  await expect(authentication.locator('input[name="password"]')).toHaveValue("Qingyu2026!");
  await notice.getByRole("button", { name: /关闭通知/ }).click();
  await expect(notice).toHaveCount(0);
  await form.getByRole("button", { name: "登录", exact: true }).click();
  await expect(authentication.getByRole("heading", { name: "你好，林小夏", exact: true })).toBeVisible();
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText("登录成功");
  await expect(authentication.locator('[data-ui-owner="Alert"]')).toHaveCount(0);
});

test("failed confirmation uses Toast while dialog remains recoverable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/components/dialog");
  await page.getByRole("tab", { name: "错误", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "错误", exact: true }).locator(".demo-explorer-preview");
  const opener = preview.getByRole("button", { name: "模拟确认失败", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "保存项目？", exact: true });
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  const notice = page.locator(".ui-toast");
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText("模拟服务器拒绝，项目尚未保存。");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-ui-owner="Alert"]')).toHaveCount(0);
  const cancel = dialog.getByRole("button", { name: "取消", exact: true });
  await expect(cancel).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("confirm-failure-toast-1440.png"), animations: "disabled" });
  await cancel.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(notice).toHaveCount(0);
});

test("Banner mounts one persistent Toast and keeps its action available", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/components/banner");
  const notice = page.locator(".ui-toast");
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText("维护通知");
  await expect(notice.locator(".ui-toast__countdown")).toHaveCount(0);
  const preview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  await expect(preview.locator('[data-ui-owner="Banner"]')).toBeHidden();
  const action = notice.getByRole("button", { name: "查看维护详情", exact: true });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(preview.getByRole("status")).toContainText("维护详情：今晚 23:00–23:30 更新配置服务");
  await expect(notice).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("banner-toast-1440.png"), animations: "disabled" });
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(notice).toHaveCount(1);
  await expect(notice.getByRole("button", { name: "查看维护详情", exact: true })).toBeVisible();
  await expect(notice.getByRole("button", { name: /关闭通知/ })).toBeVisible();
  await expect.poll(async () => {
    const bounds = await notice.boundingBox();
    return Boolean(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= 321 && bounds.y + bounds.height <= 801);
  }, { message: "Persistent Banner Toast stays inside the 320×800 viewport" }).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("banner-toast-320.png"), animations: "disabled" });
  await notice.getByRole("button", { name: /关闭通知/ }).focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
  await expect(preview.getByRole("status")).toBeVisible();
});
