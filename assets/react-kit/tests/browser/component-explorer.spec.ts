import { expect, test, type Page } from "@playwright/test";

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
    await expectCurrentRoute(page, "/#/patterns/list-filter", "列表与筛选页面");

    await page.goto("/#/components/typography");
    await expectCurrentRoute(page, "/#/components/typography", "Typography 字体规范");
    await expect(page.getByText("118 个组件家族", { exact: true })).toBeVisible();
    await expect(page.getByText("基础规范，无独立 runtime export", { exact: true })).toBeVisible();

    await page.goto("/#/components/button");
    await expectCurrentRoute(page, "/#/components/button", "Button");

    await page.reload();
    await expectCurrentRoute(page, "/#/components/button", "Button");

    await page.getByRole("link", { name: /认证与品牌登录/ }).click();
    await expectCurrentRoute(page, "/#/patterns/authentication", "认证与品牌登录");

    await page.goBack();
    await expectCurrentRoute(page, "/#/components/button", "Button");
    await page.goForward();
    await expectCurrentRoute(page, "/#/patterns/authentication", "认证与品牌登录");
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
    await expect(resultStatus).toHaveText("118 个结果");
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

    await expectCurrentRoute(page, "/#/components/data-table", "DataTable / TreeTable");
  });

  test("keeps the mobile directory usable without document overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/#/components/app-navigation");
    await expect(page.getByRole("heading", { level: 1, name: "AppNavigation 等 4 项" })).toBeVisible();

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
    await expectCurrentRoute(page, "/#/patterns/authentication", "认证与品牌登录");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test("keeps all five legacy workflows addressable by stable routes", async ({ page }) => {
    const workflows = [
      ["/#/patterns/list-filter", "列表与筛选页面", () => page.getByText("陈沐", { exact: true }).first()],
      ["/#/patterns/authentication", "认证与品牌登录", () => page.getByRole("button", { name: "登录" })],
      ["/#/components/number", "NumberInput", () => page.getByRole("heading", { name: "数字输入", exact: true })],
      ["/#/components/data-table", "DataTable / TreeTable", () => page.getByRole("table", { name: "用户权限表" })],
      ["/#/components/dialog", "Dialog / ConfirmDialog", () => page.getByRole("button", { name: "分配角色" })],
    ] as const;

    for (const [route, heading, witness] of workflows) {
      await page.goto(route);
      await expectCurrentRoute(page, route, heading);
      await expect(witness()).toBeVisible();
      await expect(page.getByRole("tab", { name: "代码", exact: true })).toBeVisible();
    }
  });
});
