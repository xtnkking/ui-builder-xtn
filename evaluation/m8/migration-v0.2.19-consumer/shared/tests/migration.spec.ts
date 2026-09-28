import { expect, test } from "@playwright/test";

test("login, form, table, and overlays survive the upgrade", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: /^账号/ }).fill("migration@example.com");
  await page.locator("#migration-password").fill("migration-secret");
  await page.getByRole("button", { name: "显示密码" }).click();
  await expect(page.locator("#migration-password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByText("登录请求已记录")).toBeVisible();

  await page.getByLabel("姓名").fill("迁移用户");
  await page.getByRole("combobox", { name: /角色/ }).click();
  await page.getByRole("option", { name: "管理员" }).click();
  await page.getByRole("button", { name: "保存员工" }).click();
  await expect(page.getByText("员工资料已保存")).toBeVisible();

  await expect(page.getByRole("table", { name: "迁移成员列表" })).toBeVisible();
  await expect(page.getByText("chen.mu@example.com")).toBeVisible();

  const drawerTrigger = page.getByRole("button", { name: "打开成员详情" });
  await drawerTrigger.click();
  await expect(page.getByRole("dialog", { name: "成员详情" })).toBeVisible();
  await page.getByRole("button", { name: "关闭抽屉" }).click();
  await expect(drawerTrigger).toBeFocused();

  await page.getByRole("button", { name: "迁移帮助", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "迁移帮助" })).toContainText(
    "这个浮层用于验证旧版触发器迁移。",
  );

  const screenshot = process.env.M8_MIGRATION_SCREENSHOT;
  if (!screenshot) throw new Error("M8_MIGRATION_SCREENSHOT is required");
  await page.screenshot({ path: screenshot, fullPage: true });
});
