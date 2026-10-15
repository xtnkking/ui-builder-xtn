import { expect, test } from "@playwright/test";

test("service and list actions own independent status and a single page heading", async ({ page }) => {
  await page.goto("/#/patterns/list-filter");
  await page.getByRole("tab", { name: "默认", exact: true }).click();
  const preview = page.getByRole("tabpanel", { name: "默认", exact: true }).locator(".demo-explorer-preview");
  await preview.getByRole("tab", { name: "作用域分离", exact: true }).click();
  const content = preview.getByRole("tabpanel", { name: "作用域分离", exact: true });
  const service = content.getByRole("region", { name: "服务状态", exact: true });
  const filters = content.getByRole("form", { name: "任务列表筛选", exact: true });
  await expect(content.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(content.getByRole("button", { name: /查询任务|检查服务状态/ })).toHaveCount(2);
  await filters.getByRole("searchbox", { name: "任务名称", exact: true }).fill("库存");
  await filters.getByRole("searchbox", { name: "任务名称", exact: true }).press("Enter");
  await expect(filters.getByRole("status")).toContainText("任务列表更新于");
  await expect(service.getByRole("status")).toHaveText("服务状态尚未检查");
  await expect(content.getByRole("table", { name: "任务列表", exact: true })).toContainText("同步商品库存");
  await expect(content.getByRole("table", { name: "任务列表", exact: true })).not.toContainText("核对订单金额");
  const listStatus = await filters.getByRole("status").textContent();
  await service.getByRole("button", { name: "检查服务状态", exact: true }).click();
  await expect(service.getByRole("status")).toContainText("服务状态更新于");
  await expect(filters.getByRole("status")).toHaveText(listStatus!);
  await content.screenshot({ path: test.info().outputPath("scoped-list-desktop.png") });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(content.getByRole("heading", { level: 1 })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await content.screenshot({ path: test.info().outputPath("scoped-list-320.png") });
});
