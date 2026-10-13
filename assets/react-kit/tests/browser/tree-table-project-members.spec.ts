// @ui-coverage {"kind":"browser","runner":"browser","exports":["TreeTable"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function projectPreview(page: Page, state = "总览") {
  await page.goto("/#/components/data-table");
  const caseName = "项目、项目组与成员预览";
  await page.getByRole("tab", { name: caseName, exact: true }).click();
  const casePanel = page.getByRole("tabpanel", { name: caseName, exact: true });
  if (state !== "总览") await casePanel.getByRole("tab", { name: state, exact: true }).click();
  return casePanel.locator(".demo-explorer-preview");
}

function projectControls(preview: Locator) {
  const tree = preview.locator('[data-ui-owner="TreeTable"]');
  return {
    tree,
    table: tree.getByRole("table", { name: "项目组织与成员", exact: true }),
    totals: tree.locator(".ui-tree-table__footer").getByRole("status"),
    viewport: tree.getByRole("region", { name: "项目组织与成员", exact: true }),
    project: tree.getByRole("button", { name: "加载所有项目组：客户协作平台", exact: true }),
    group: (name: string) => tree.getByRole("button", { name: `加载所有成员：${name}`, exact: true }),
  };
}

test("TreeTable project buttons load complete groups and member branches exactly once while expansion reuses cached nodes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { tree, table, totals, project, group } = projectControls(await projectPreview(page));
  await expect(totals).toHaveText("2 个项目 · 0 个项目组 · 0 位成员 · 已发起 0 次请求");
  await table.getByRole("button", { name: "折叠 客户协作平台", exact: true }).click();
  await table.getByRole("button", { name: "展开 客户协作平台", exact: true }).click();
  await expect(totals).toContainText("已发起 0 次请求");
  await project.dblclick();
  await expect(project).toHaveAttribute("aria-busy", "true");
  await expect(project).toHaveAttribute("aria-disabled", "true");
  await expect(table.getByRole("cell", { name: "项目组", exact: true })).toHaveCount(3);
  for (const name of ["产品设计组", "平台开发组", "质量保障组"]) await expect(group(name)).toBeEnabled();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(0);
  await expect(project).toBeDisabled();
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 0 位成员 · 已发起 1 次请求");

  const design = group("产品设计组");
  await design.dblclick();
  await expect(design).toHaveAttribute("aria-busy", "true");
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(2);
  await expect(table.getByRole("cell", { name: "陈晨", exact: true })).toHaveCount(1);
  await expect(design).toBeDisabled();
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 2 位成员 · 已发起 2 次请求");
  await table.getByRole("button", { name: "折叠 产品设计组", exact: true }).click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(0);
  await table.getByRole("button", { name: "展开 产品设计组", exact: true }).click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(2);
  await expect(totals).toContainText("已发起 2 次请求");
  await group("平台开发组").click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(5);
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 5 位成员 · 已发起 3 次请求");
  await tree.screenshot({ path: test.info().outputPath("project-members-loaded-desktop.png"), animations: "disabled" });
});

test("TreeTable failed group requests retry independently of concurrent siblings and loaded-empty branches remain cached", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { tree, table, totals, project, group } = projectControls(await projectPreview(page, "错误"));
  await project.click();
  await expect(group("产品设计组")).toBeVisible();
  const design = group("产品设计组");
  const platform = group("平台开发组");
  await design.click();
  await platform.click();
  await expect(design).toHaveAttribute("aria-busy", "true");
  await expect(platform).toHaveAttribute("aria-busy", "true");
  await expect(design.locator("xpath=ancestor::tr").getByRole("alert")).toHaveText("加载失败");
  await expect(design).toBeEnabled();
  await expect(platform).toBeDisabled();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(3);
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 3 位成员 · 已发起 3 次请求");
  await design.click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(5);
  await expect(tree.getByRole("alert")).toHaveCount(0);
  await expect(table.getByRole("cell", { name: "许言", exact: true })).toHaveCount(1);

  const quality = group("质量保障组");
  const internal = tree.getByRole("button", { name: "加载所有项目组：内部工具项目", exact: true });
  await quality.click();
  await internal.click();
  await expect(quality.locator("xpath=ancestor::tr").getByText("暂无成员", { exact: true })).toBeVisible();
  await expect(internal.locator("xpath=ancestor::tr").getByText("暂无项目组", { exact: true })).toBeVisible();
  await expect(quality).toBeDisabled();
  await expect(internal).toBeDisabled();
  await table.getByRole("button", { name: "折叠 质量保障组", exact: true }).click();
  await table.getByRole("button", { name: "展开 质量保障组", exact: true }).click();
  await table.getByRole("button", { name: "折叠 内部工具项目", exact: true }).click();
  await table.getByRole("button", { name: "展开 内部工具项目", exact: true }).click();
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 5 位成员 · 已发起 6 次请求");
  await expect(table.getByRole("cell", { name: "项目组", exact: true })).toHaveCount(3);
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(5);
});

test("TreeTable project loading supports a bounded 320px keyboard viewport and reset discards pending responses", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.clock.install();
  const { tree, table, totals, viewport, project, group } = projectControls(await projectPreview(page));
  await viewport.focus();
  await viewport.press("Tab");
  await expect(table.getByRole("button", { name: "折叠 客户协作平台", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(project).toBeFocused();
  await project.press("Enter");
  await expect(project).toHaveAttribute("aria-busy", "true");
  const reset = tree.getByRole("button", { name: "重置案例", exact: true });
  await reset.focus();
  await reset.press("Enter");
  // Advance beyond the actual 900ms mock request, proving the obsolete response cannot write back.
  await page.clock.runFor(1000);
  await expect(totals).toHaveText("2 个项目 · 0 个项目组 · 0 位成员 · 已发起 0 次请求");
  await expect(table.getByRole("cell", { name: "项目组", exact: true })).toHaveCount(0);
  await expect(project).toBeEnabled();
  await project.focus();
  await project.press("Enter");
  await page.clock.runFor(1000);
  await expect(group("产品设计组")).toBeVisible();
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 0 位成员 · 已发起 1 次请求");

  expect(await viewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await viewport.evaluate((node) => { node.scrollLeft = 0; });
  await viewport.focus();
  await viewport.press("ArrowRight");
  await page.clock.runFor(250);
  await expect.poll(() => viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  const design = group("产品设计组");
  await design.focus();
  await expect(design).toBeFocused();
  await design.press("Space");
  await expect(design).toHaveAttribute("aria-busy", "true");
  await page.clock.runFor(1000);
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(2);
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 2 位成员 · 已发起 2 次请求");
  await tree.screenshot({ path: test.info().outputPath("project-members-loaded-320.png"), animations: "disabled" });
});

test("TreeTable parent summaries remain attached to their branches when collapsed and at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const { tree, table, totals, viewport, project, group } = projectControls(await projectPreview(page));
  const parentRow = (name: string, kind: "项目" | "项目组") => table.getByRole("row").filter({
    has: page.getByRole("button", {
      name: `${kind === "项目" ? "加载所有项目组" : "加载所有成员"}：${name}`,
      exact: true,
    }),
  });
  const projectRow = parentRow("客户协作平台", "项目");
  const designRow = parentRow("产品设计组", "项目组");
  const platformRow = parentRow("平台开发组", "项目组");
  await project.click();
  await expect(group("产品设计组")).toBeVisible();
  await group("产品设计组").click();
  await group("平台开发组").click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(5);
  await expect(projectRow.getByRole("cell").nth(3)).toHaveText("3 个项目组");
  await expect(designRow.getByRole("cell").nth(3)).toHaveText("2 位成员");
  await expect(platformRow.getByRole("cell").nth(3)).toHaveText("3 位成员");
  await expect(table.locator("tr.ui-tree-table__branch-footer")).toHaveCount(0);
  await expect(projectRow.locator("strong")).toHaveText("客户协作平台");
  await expect(designRow.locator('[data-ui-owner="Tag"] svg')).toHaveCount(1);
  await tree.screenshot({ path: test.info().outputPath("project-members-parent-summaries-desktop.png"), animations: "disabled" });

  await table.getByRole("button", { name: "折叠 产品设计组", exact: true }).click();
  await expect(designRow.getByRole("cell").nth(3)).toHaveText("2 位成员");
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(3);
  await table.getByRole("button", { name: "折叠 客户协作平台", exact: true }).click();
  await expect(projectRow.getByRole("cell").nth(3)).toHaveText("3 个项目组");
  await expect(designRow).toHaveCount(0);
  await table.getByRole("button", { name: "展开 客户协作平台", exact: true }).click();
  await expect(designRow.getByRole("cell").nth(3)).toHaveText("2 位成员");
  await expect(platformRow.getByRole("cell").nth(3)).toHaveText("3 位成员");
  await table.getByRole("button", { name: "展开 产品设计组", exact: true }).click();
  await expect(table.getByRole("cell", { name: "成员", exact: true })).toHaveCount(5);
  await expect(totals).toHaveText("2 个项目 · 3 个项目组 · 5 位成员 · 已发起 3 次请求");

  await page.setViewportSize({ width: 320, height: 1100 });
  expect(await viewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  for (const row of [projectRow, designRow, platformRow]) {
    for (const control of [row.locator('[data-ui-owner="Tag"]'), row.getByRole("cell").nth(4).getByRole("button")]) {
      const contained = await control.evaluate((node) => {
        const cell = node.closest("td");
        if (!cell) return false;
        const controlBounds = node.getBoundingClientRect();
        const cellBounds = cell.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return controlBounds.left >= cellBounds.left + parseFloat(style.paddingLeft) - 1
          && controlBounds.right <= cellBounds.right - parseFloat(style.paddingRight) + 1;
      });
      expect(contained).toBe(true);
    }
  }
  await viewport.evaluate((node) => { node.scrollLeft = 0; });
  await tree.screenshot({ path: test.info().outputPath("project-members-parent-summaries-320.png"), animations: "disabled" });
});
