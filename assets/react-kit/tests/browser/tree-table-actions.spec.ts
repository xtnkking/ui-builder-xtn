// @ui-coverage {"kind":"browser","runner":"browser","exports":["TreeTable"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function previewFor(page: Page, state = "使用方式") {
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: state, exact: true }).click();
  return page.getByRole("tabpanel", { name: state, exact: true }).locator(".demo-explorer-preview");
}

function treeIn(preview: Locator) {
  return preview.locator('[data-ui-owner="TreeTable"]');
}

async function bounds(node: Locator) {
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test("TreeTable branch actions follow all descendants and retain loading geometry without duplicate additions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const tree = treeIn(await previewFor(page));
  const table = tree.getByRole("table", { name: "文件目录", exact: true });
  const add = table.getByRole("button", { name: "在 设计资产 下新增子项", exact: true });
  const parentAdd = table.getByRole("button", { name: "在 产品工作区 下新增子项", exact: true });
  await expect(add.locator("xpath=ancestor::tr")).toHaveClass(/ui-tree-table__branch-footer/);
  expect(await add.locator("xpath=ancestor::tr").evaluate((row) => row.previousElementSibling?.textContent)).toContain("主题令牌.json");
  expect(await parentAdd.locator("xpath=ancestor::tr").evaluate((row) => row.previousElementSibling?.textContent)).toContain("发布记录.md");
  const idle = await bounds(add);
  await add.dblclick();
  await expect(add).toHaveAttribute("aria-busy", "true");
  await expect(add).toHaveAttribute("aria-disabled", "true");
  const loading = await bounds(add);
  expect(Math.abs(loading.width - idle.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(loading.height - idle.height)).toBeLessThanOrEqual(1);
  await expect(table.getByText("新建文件 1.md", { exact: true })).toHaveCount(1);
  await expect(add).not.toHaveAttribute("aria-busy", "true");
  expect(await add.locator("xpath=ancestor::tr").evaluate((row) => row.previousElementSibling?.textContent)).toContain("新建文件 1.md");
  await expect(tree.getByRole("status")).toHaveText("共 3 个目录 · 3 个文件");
  const collapse = table.getByRole("button", { name: "折叠 设计资产", exact: true });
  await collapse.focus();
  await collapse.press("Enter");
  await expect(add).toHaveCount(0);
  await expect(table.getByText("新建文件 1.md", { exact: true })).toHaveCount(0);
  await expect(parentAdd).toBeVisible();
  const expand = table.getByRole("button", { name: "展开 设计资产", exact: true });
  await expand.press("Enter");
  await expect(add).toBeVisible();
  await expect(table.getByText("新建文件 1.md", { exact: true })).toHaveCount(1);
  await expect(tree.getByRole("status")).toHaveText("共 3 个目录 · 3 个文件");
});

test("TreeTable toolbar empty-directory and row operations update actual nodes and footer totals", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const tree = treeIn(await previewFor(page));
  const toolbar = tree.getByRole("group", { name: "目录工具栏", exact: true });
  await toolbar.getByRole("button", { name: "新增根目录", exact: true }).click();
  await expect(tree.getByText("新建目录 1", { exact: true })).toBeVisible();
  await expect(tree.getByRole("status")).toHaveText("共 4 个目录 · 2 个文件");
  await toolbar.getByRole("button", { name: "全部展开", exact: true }).click();
  const addToEmpty = tree.getByRole("button", { name: "在 历史归档 下新增子项", exact: true });
  await expect(addToEmpty).toBeVisible();
  await expect(tree.getByRole("button", { name: "在 新建目录 1 下新增子项", exact: true })).toBeVisible();
  await addToEmpty.click();
  await expect(tree.getByText("新建文件 2.md", { exact: true })).toBeVisible();
  await expect(tree.getByRole("status")).toHaveText("共 4 个目录 · 3 个文件");
  await tree.getByRole("button", { name: "操作 新建文件 2.md", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑名称", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "编辑名称", exact: true });
  await edit.getByRole("textbox", { name: "名称", exact: true }).fill("归档审计记录.md");
  await edit.getByRole("button", { name: "保存", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(tree.getByText("新建文件 2.md", { exact: true })).toHaveCount(0);
  await expect(tree.getByText("归档审计记录.md", { exact: true })).toBeVisible();
  await tree.getByRole("button", { name: "操作 归档审计记录.md", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除文件", exact: true }).click();
  await expect(tree.getByText("归档审计记录.md", { exact: true })).toHaveCount(0);
  await expect(addToEmpty).toBeVisible();
  await expect(tree.getByRole("status")).toHaveText("共 4 个目录 · 2 个文件");
  await tree.getByRole("button", { name: "操作 主题令牌.json", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除文件", exact: true }).click();
  await expect(tree.getByText("主题令牌.json", { exact: true })).toHaveCount(0);
  await expect(tree.getByRole("button", { name: "在 设计资产 下新增子项", exact: true })).toBeVisible();
  await expect(tree.getByRole("status")).toHaveText("共 4 个目录 · 1 个文件");
  await tree.getByRole("button", { name: "操作 新建目录 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "删除目录及子项", exact: true }).click();
  await expect(tree.getByText("新建目录 1", { exact: true })).toHaveCount(0);
  await expect(tree.getByRole("status")).toHaveText("共 3 个目录 · 1 个文件");
  await toolbar.getByRole("button", { name: "全部收起", exact: true }).click();
  await expect(tree.locator(".ui-tree-table__branch-footer")).toHaveCount(0);
  await expect(tree.getByRole("table").getByRole("row")).toHaveCount(3);
  await expect(toolbar).toBeVisible();
});

test("TreeTable action slots stay outside the bounded viewport for long mobile and dark layouts", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  let tree = treeIn(await previewFor(page));
  await tree.getByRole("button", { name: "操作 产品工作区", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑名称", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "编辑名称", exact: true });
  await edit.getByRole("textbox", { name: "名称", exact: true }).fill("跨区域产品工作区：订阅服务、客户成功、权限配置与所有历史发布记录的统一管理目录");
  await edit.getByRole("button", { name: "保存", exact: true }).click();
  await expect(edit).toHaveCount(0);
  for (const state of ["使用方式", "深色模式"]) {
    if (state === "深色模式") tree = treeIn(await previewFor(page, state));
    const viewport = tree.getByRole("region", { name: "文件目录", exact: true });
    await viewport.evaluate((node) => { node.scrollLeft = 0; });
    const toolbar = tree.getByRole("group", { name: "目录工具栏", exact: true });
    const totals = tree.getByRole("status");
    const outer = await bounds(tree);
    const scroller = await bounds(viewport);
    const top = await bounds(toolbar);
    const bottom = await bounds(totals);
    expect(scroller.width).toBeLessThanOrEqual(outer.width);
    expect(top.y + top.height).toBeLessThanOrEqual(scroller.y + 1);
    expect(bottom.y).toBeGreaterThanOrEqual(scroller.y + scroller.height - 1);
    expect(await viewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await tree.screenshot({ path: test.info().outputPath(`tree-actions-${state === "使用方式" ? "long" : "dark"}-320.png`), animations: "disabled" });
    await viewport.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    const action = tree.getByRole("button", { name: "操作 历史归档", exact: true });
    await action.click();
    await expect(page.getByRole("menuitem", { name: "编辑名称", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(action).toBeFocused();
  }
});
