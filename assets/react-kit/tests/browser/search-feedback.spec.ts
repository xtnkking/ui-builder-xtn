// @ui-coverage {"kind":"browser","runner":"browser","exports":["FilterBar","DataTable","ToastProvider","useToast"]}
import { expect, test, type Page } from "@playwright/test";

async function searchCase(page: Page) {
  await page.goto("/#/components/filter-bar");
  await page.getByRole("tab", { name: "搜索反馈预览", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "搜索反馈预览", exact: true });
  const preview = panel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const form = preview.getByRole("form", { name: "成员查询", exact: true });
  const table = preview.locator('[data-ui-owner="DataTable"]');
  const toasts = page.locator(".ui-toast");
  // Initial asynchronous loading is intentionally silent, including its successful completion.
  await expect(toasts).toHaveCount(0);
  await expect(table).toHaveAttribute("data-state", "ready");
  await expect(table.getByRole("table", { name: "成员列表", exact: true })).toContainText("林夏");
  await expect(toasts).toHaveCount(0);
  return {
    preview, form, table, toasts,
    input: form.getByRole("searchbox", { name: "成员关键词", exact: true }),
    query: form.getByRole("button", { name: "查询", exact: true }),
    notifications: preview.getByRole("switch", { name: "搜索完成后轻提示", exact: true }),
  };
}

async function freezeRequests(page: Page) {
  // Freeze only after the initial React effect/request has actually settled. Each later
  // 500 ms request is then advanced explicitly, so pending assertions cannot race the CPU.
  const time = new Date("2026-10-15T00:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
}

test("search completion notifies once after the submitted snapshot succeeds and duplicate Enter is blocked", async ({ page }) => {
  const { preview, form, table, toasts, input, query, notifications } = await searchCase(page);
  await expect(notifications).toBeChecked();
  await freezeRequests(page);
  await input.fill("林");
  await expect(preview.getByText("已应用关键词：全部成员", { exact: true })).toBeVisible();
  await expect(table).toHaveAttribute("data-state", "ready");
  await expect(toasts).toHaveCount(0);

  await query.click();
  await expect(query).toHaveAttribute("aria-busy", "true");
  await expect(query).toHaveAttribute("aria-disabled", "true");
  await expect(table).toHaveAttribute("data-state", "loading");
  await expect(toasts).toHaveCount(0);
  await input.fill("陈");
  await input.press("Enter");
  await page.clock.runFor(499);
  await expect(query).toHaveAttribute("aria-busy", "true");
  await expect(toasts).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(table).toHaveAttribute("data-state", "ready");
  await expect(preview.getByText("已应用关键词：林", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("陈");
  const results = table.getByRole("table", { name: "成员列表", exact: true });
  await expect(results).toContainText("林夏");
  await expect(results).not.toContainText("陈屿");
  await expect(toasts).toHaveCount(1);
  await expect(toasts).toHaveAttribute("role", "status");
  await expect(toasts.locator(".ui-toast__copy > strong")).toHaveText("查询完成");
  await expect(toasts).toContainText("结果已更新，可继续查看成员列表。");
  // Beyond a second request's full lifetime, no queued duplicate may apply the newer draft.
  await page.clock.runFor(600);
  await expect(toasts).toHaveCount(1);
  await expect(preview.getByText("已应用关键词：林", { exact: true })).toBeVisible();
  await expect(form.getByRole("button", { name: "查询", exact: true })).not.toHaveAttribute("aria-busy", "true");
  await preview.screenshot({ path: test.info().outputPath("search-feedback-success.png"), animations: "disabled" });
});

test("optional success feedback and pagination stay silent while empty search reports after completion at 320px", async ({ page }) => {
  const { preview, table, toasts, input, query, notifications } = await searchCase(page);
  await freezeRequests(page);
  await notifications.uncheck();
  await query.click();
  await expect(query).toHaveAttribute("aria-busy", "true");
  await page.clock.runFor(500);
  await expect(table).toHaveAttribute("data-state", "ready");
  await expect(toasts).toHaveCount(0);

  await table.getByRole("button", { name: "第 2 页", exact: true }).click();
  await page.clock.runFor(500);
  await expect(table.getByRole("button", { name: "第 2 页", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(table.getByRole("table", { name: "成员列表", exact: true })).toContainText("赵舒");
  await expect(toasts).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 1100 });
  await notifications.check();
  await input.fill("没有匹配的成员");
  await query.click();
  await page.clock.runFor(499);
  await expect(toasts).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(table).toHaveAttribute("data-state", "empty");
  await expect(toasts).toHaveCount(1);
  await expect(toasts).toHaveAttribute("role", "status");
  await expect(toasts).toHaveClass(/ui-toast--info/);
  await expect(toasts.locator(".ui-toast__copy > strong")).toHaveText("未找到匹配结果");
  await expect(toasts).toContainText("请调整关键词后重新查询。");
  await expect(table.getByText("没有匹配的成员", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("search-feedback-empty-320.png"), animations: "disabled" });

  await toasts.getByRole("button", { name: "关闭通知：未找到匹配结果", exact: true }).click();
  await page.clock.runFor(350);
  await expect(toasts).toHaveCount(0);
  await expect(table).toHaveAttribute("data-state", "empty");
  await expect(table.getByText("没有匹配的成员", { exact: true })).toBeVisible();
});

test("a table-owned failure notifies once keeps cached rows and retries its failed snapshot without another Toast", async ({ page }) => {
  const { preview, table, toasts, input, query } = await searchCase(page);
  await freezeRequests(page);
  await preview.getByRole("button", { name: "模拟下次查询失败", exact: true }).click();
  await input.fill("林");
  await query.click();
  await expect(query).toHaveAttribute("aria-busy", "true");
  await input.fill("陈");
  await page.clock.runFor(500);
  await expect(table).toHaveAttribute("data-state", "error");
  await expect(toasts).toHaveCount(1);
  await expect(toasts).toHaveAttribute("role", "alert");
  await expect(toasts).toContainText("成员列表：查询失败");
  await expect(toasts).toContainText("已保留上次结果，请重试。");
  const results = table.getByRole("table", { name: "成员列表", exact: true });
  await expect(results).toContainText("林夏");
  await expect(results).toContainText("陈屿");
  await expect(preview.getByText("已应用关键词：全部成员", { exact: true })).toBeVisible();
  await expect(preview.locator('[data-ui-owner="Alert"]')).toHaveCount(0);
  await toasts.getByRole("button", { name: "关闭通知：已保留上次结果，请重试。", exact: true }).click();
  await page.clock.runFor(350);
  await expect(toasts).toHaveCount(0);
  const retry = table.getByRole("button", { name: "重试", exact: true });
  await expect(retry).toBeVisible();
  await expect(table.getByText("刷新失败，保留原数据", { exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect(retry).toBeVisible();
  await expect(toasts).toHaveCount(0);

  await retry.press("Enter");
  await expect(table).toHaveAttribute("aria-busy", "true");
  await page.clock.runFor(500);
  await expect(table).toHaveAttribute("data-state", "ready");
  await expect(preview.getByText("已应用关键词：林", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("陈");
  await expect(results).toContainText("林夏");
  await expect(results).not.toContainText("陈屿");
  await expect(toasts).toHaveCount(0);
  await expect(retry).toHaveCount(0);
});
