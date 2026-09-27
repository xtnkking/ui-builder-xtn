export const legacyExplorerCaseTabs = Object.freeze({
  authentication: "品牌家族登录预览",
  dataTable: "用户权限表格预览",
  dialog: "复杂弹窗工作流预览",
  listFilter: "成员管理预览",
  number: "数字输入状态预览",
});

export async function selectExplorerCase(page, tabName) {
  const tab = page.getByRole("tab", { name: tabName, exact: true });
  await tab.click();
  const panel = page.getByRole("tabpanel", { name: tabName, exact: true });
  await panel.waitFor({ state: "visible" });
  return panel;
}
