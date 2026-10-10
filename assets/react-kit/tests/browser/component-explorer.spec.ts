import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const componentManifest = JSON.parse(
  readFileSync(new URL("../../component-manifest.json", import.meta.url), "utf8"),
) as { entries: unknown[] };
const explorerFamilyCount = componentManifest.entries.length;

async function expectCurrentRoute(page: Page, route: string, heading: string | RegExp) {
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  const current = page.locator('a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("href", route.slice(1));
}

test.describe("component explorer", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("canonicalizes routes and preserves direct links across reload and history", async ({ page }) => {
    await page.goto("/#/components/authentication");
    await expectCurrentRoute(page, "/#/patterns/list-filter", /^列表与筛选页面/);

    await page.goto("/#/components/typography");
    await expectCurrentRoute(page, "/#/components/typography", /^字体与排版\s*Typography$/);
    await expect(page.getByText(`${explorerFamilyCount} 个组件家族`, { exact: true })).toBeVisible();
    await expect(page.getByText("基础规范，无独立 runtime export", { exact: true })).toBeVisible();

    await page.goto("/#/components/button");
    await expectCurrentRoute(page, "/#/components/button", /^按钮\s*Button$/);

    await page.reload();
    await expectCurrentRoute(page, "/#/components/button", /^按钮\s*Button$/);

    await page.getByRole("link", { name: /认证与品牌登录/ }).click();
    await expectCurrentRoute(page, "/#/patterns/authentication", /^认证与品牌登录/);

    await page.goBack();
    await expectCurrentRoute(page, "/#/components/button", /^按钮\s*Button$/);
    await page.goForward();
    await expectCurrentRoute(page, "/#/patterns/authentication", /^认证与品牌登录/);
  });

  test("searches by alias, public export, and use case, then exposes a clear no-results state", async ({ page }) => {
    await page.goto("/#/components/button");
    const directory = page.getByLabel("组件目录");
    const search = directory.getByRole("searchbox", { name: "搜索组件" });
    const resultStatus = directory.getByRole("status").filter({ hasText: /^\d+ 个结果$/ });

    await search.fill("rich-text-editor");
    await expect(resultStatus).toHaveText("1 个结果");
    await expect(directory.getByRole("link", { name: /MarkdownEditor \/ RichTextEditor/ })).toBeVisible();

    await search.fill("DataTable");
    await expect(resultStatus).toHaveText("1 个结果");
    await expect(directory.getByRole("link", { name: /DataTable \/ TreeTable/ })).toBeVisible();

    await search.fill("登录");
    await expect(resultStatus).toHaveText("1 个结果");
    await expect(directory.getByRole("link", { name: /认证与品牌登录/ })).toBeVisible();

    await search.fill("not-a-personal-ui-family");
    await expect(resultStatus).toHaveText("0 个结果");
    await expect(directory.getByText("没有匹配的组件", { exact: true })).toBeVisible();

    await directory.getByRole("button", { name: "清除搜索" }).click();
    await expect(resultStatus).toHaveText(`${explorerFamilyCount} 个结果`);
    await expect(search).toHaveValue("");
  });

  test("supports keyboard navigation from search to the filtered family", async ({ page }) => {
    await page.goto("/#/components/button");
    const directory = page.getByLabel("组件目录");
    const search = directory.getByRole("searchbox", { name: "搜索组件" });

    await search.focus();
    await page.keyboard.type("data-table");
    await page.keyboard.press("Tab");
    await expect(directory.getByRole("button", { name: "清除搜索" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(directory.getByRole("link", { name: /DataTable \/ TreeTable/ })).toBeFocused();
    await page.keyboard.press("Enter");

    await expectCurrentRoute(page, "/#/components/data-table", /^数据与树形表格\s*DataTable \/ TreeTable$/);
  });

  test("keeps the mobile directory usable without document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/#/components/app-navigation");
    await expect(page.getByRole("heading", { level: 1, name: /^应用导航\s*AppNavigation/ })).toBeVisible();

    await expect.poll(() => page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))).toEqual({ clientWidth: 320, scrollWidth: 320 });

    await page.getByRole("button", { name: "组件目录" }).click();
    const drawer = page.getByRole("dialog", { name: "组件目录" });
    await expect(drawer).toBeVisible();
    const search = drawer.getByRole("searchbox", { name: "搜索移动端组件目录" });
    await search.fill("登录");
    await expect(drawer.getByRole("link", { name: /认证与品牌登录/ })).toBeVisible();
    await drawer.getByRole("link", { name: /认证与品牌登录/ }).press("Enter");

    await expect(drawer).toBeHidden();
    await expectCurrentRoute(page, "/#/patterns/authentication", /^认证与品牌登录/);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test("keeps all five legacy workflows addressable by stable routes", async ({ page }) => {
    const workflows = [
      ["/#/patterns/list-filter", /^列表与筛选页面/, () => page.getByRole("tab", { name: "列表管理", exact: true })],
      ["/#/patterns/authentication", /^认证与品牌登录/, () => page.getByRole("button", { name: "登录" })],
      ["/#/components/number", /^数字输入框\s*NumberInput$/, () => page.getByRole("heading", { name: "数字步进输入", exact: true })],
      ["/#/components/data-table", /^数据与树形表格/, () => page.getByRole("table", { name: "账户列表" })],
      ["/#/components/dialog", /^对话框与确认弹窗/, () => page.getByRole("button", { name: "编辑项目" })],
    ] as const;

    for (const [route, heading, witness] of workflows) {
      await page.goto(route);
      await expectCurrentRoute(page, route, heading);
      await expect(witness()).toBeVisible();
      await expect(page.getByRole("tab", { name: /代码$/ }).first()).toBeVisible();
    }
  });

  test("keeps small-control previews inset and bounded on wide screens with Chinese-first labels", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1239 });
    await page.goto("/#/components/button");
    const preview = page.locator(".demo-explorer-preview");
    const frame = await preview.boundingBox();
    const button = await preview.getByRole("button", { name: "保存更改", exact: true }).boundingBox();
    expect(frame).not.toBeNull();
    expect(button).not.toBeNull();
    expect(frame!.width).toBeLessThanOrEqual(720);
    expect(button!.x - frame!.x).toBeGreaterThanOrEqual(24);
    expect(button!.y - frame!.y).toBeGreaterThanOrEqual(24);
    expect(frame!.y + frame!.height - button!.y - button!.height).toBeGreaterThanOrEqual(24);
    const names = await page.getByLabel("组件目录", { exact: true }).getByRole("link").allTextContents();
    expect(names).toHaveLength(explorerFamilyCount);
    expect(names.every((name) => /^[\u3400-\u9fff]/.test(name))).toBe(true);
    await expect(page.getByRole("tab", { name: "默认", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "长内容", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("button-wide.png") });
  });

  test("constrains long button groups and retains usable controls at 320px", async ({ page }) => {
    await page.goto("/#/components/button-group");
    await page.getByRole("tab", { name: "长内容", exact: true }).click();
    const group = page.getByRole("group", { name: "长操作名称" });
    expect((await group.boundingBox())!.width).toBeLessThanOrEqual(360);
    const actions = group.getByRole("button");
    const save = (await actions.nth(0).boundingBox())!;
    const cancel = (await actions.nth(1).boundingBox())!;
    expect(Math.abs(save.width - cancel.width)).toBeLessThanOrEqual(1);
    expect(save.height).toBeLessThanOrEqual(44);
    expect(cancel.height).toBeLessThanOrEqual(44);
    await page.screenshot({ path: test.info().outputPath("button-group-long.png") });
    await page.setViewportSize({ width: 320, height: 720 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    expect((await group.boundingBox())!.width).toBeLessThanOrEqual(254);
    await page.screenshot({ path: test.info().outputPath("button-group-mobile.png") });
  });

  test("keeps selection-column names accessible without vertically stacked row labels", async ({ page }) => {
    await page.goto("/#/components/data-table");
    const table = page.getByRole("table", { name: "账户列表", exact: true });
    await expect(table).toBeVisible();
    const selection = table.getByRole("checkbox").first();
    await expect(selection).toHaveAccessibleName(/^选择 .+账户/);
    const rowHeights = await table.locator("tbody tr").evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
    expect(rowHeights.length).toBe(3);
    expect(rowHeights.every((height) => height <= 72)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("table-selection.png") });
  });
});
