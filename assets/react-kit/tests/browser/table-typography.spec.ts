// @ui-coverage {"kind":"browser","runner":"browser","exports":["DataTable","TreeTable","TableCellText"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function typographyCase(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/#/components/data-table");
  await page.getByRole("tab", { name: "表格正文排版预览", exact: true }).click();
  const casePanel = page.getByRole("tabpanel", { name: "表格正文排版预览", exact: true });
  const preview = casePanel.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  await expect(preview.getByRole("table", { name: "任务数据正文排版", exact: true })).toBeVisible();
  return { casePanel, preview, table: preview.getByRole("table", { name: "任务数据正文排版", exact: true }) };
}

async function primaryStyles(primary: Locator) {
  return primary.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, numeric: style.fontVariantNumeric };
  }));
}

test("table task text and tree cells share primary typography while controls retain their own styles", async ({ page }) => {
  const { preview, table } = await typographyCase(page);
  const primaries = table.locator("tbody .ui-table-cell-text__primary");
  await expect(primaries).toHaveCount(27);
  const styles = await primaryStyles(primaries);
  expect(styles.every((style) => style.font === styles[0].font && style.size === "14px" && style.weight === "400" && style.lineHeight === "21px")).toBe(true);
  const numeric = await primaryStyles(table.locator(".ui-table-cell-text--numeric .ui-table-cell-text__primary"));
  expect(numeric.every((style) => style.numeric === "tabular-nums" && style.weight === "400")).toBe(true);
  const plain = await primaryStyles(table.locator("tbody tr").first().getByRole("cell").first().locator(".ui-table-cell-text__primary"));
  expect(plain[0].numeric).toBe("normal");
  const zero = table.locator("tbody tr").first().getByRole("cell").nth(7).locator(".ui-table-cell-text__primary");
  await expect(zero).toHaveText("0");
  const supporting = await table.locator(".ui-table-cell-text__secondary").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { size: style.fontSize, lineHeight: style.lineHeight, color: style.color };
  });
  expect(supporting.size).toBe("12px");
  expect(supporting.lineHeight).toBe("18px");
  const treeStyles = await primaryStyles(preview.getByRole("table", { name: "项目树表正文排版", exact: true }).locator("tbody .ui-table-cell-text__primary"));
  expect(treeStyles).toHaveLength(6);
  expect(treeStyles.every((style) => style.font === styles[0].font && style.size === "14px" && style.weight === "400" && style.lineHeight === "21px")).toBe(true);
  const tag = table.locator('[data-ui-owner="Tag"]').first();
  expect(await tag.evaluate((element) => getComputedStyle(element).fontSize)).toBe("12px");
  expect(await table.locator('[data-ui-owner="Button"]').first().evaluate((element) => getComputedStyle(element).fontSize)).toBe("13px");
  await preview.screenshot({ path: test.info().outputPath("table-typography-1440.png"), animations: "disabled" });
  await table.getByRole("button", { name: "查看任务 26090817113818751879", exact: true }).click();
  await expect(page.locator(".ui-toast")).toContainText("已选择任务 26090817113818751879");
});

test("fixed table columns truncate full text by default and wrap or emphasize only when requested", async ({ page }) => {
  const { casePanel } = await typographyCase(page);
  await casePanel.getByRole("tab", { name: "长内容", exact: true }).click();
  const table = casePanel.getByRole("table", { name: "长文本与显式强调", exact: true });
  const cells = table.locator("tbody tr").getByRole("cell");
  const truncated = cells.nth(0).locator(".ui-table-cell-text__primary");
  const fullText = await truncated.textContent();
  await expect(truncated).toHaveAttribute("title", fullText!);
  const ellipse = await truncated.evaluate((element) => {
    const style = getComputedStyle(element);
    return { clipped: element.scrollWidth > element.clientWidth, whiteSpace: style.whiteSpace, ellipsis: style.textOverflow };
  });
  expect(ellipse).toEqual({ clipped: true, whiteSpace: "nowrap", ellipsis: "ellipsis" });
  const primaryAndSecondary = cells.nth(1).locator(".ui-table-cell-text__primary, .ui-table-cell-text__secondary");
  for (const text of await primaryAndSecondary.all()) {
    const value = await text.textContent();
    await expect(text).toHaveAttribute("title", value!);
    expect(await text.evaluate((element) => element.getBoundingClientRect().width <= element.closest("td")!.getBoundingClientRect().width)).toBe(true);
  }
  const wrapped = cells.nth(2).locator(".ui-table-cell-text__primary");
  const wrap = await wrapped.evaluate((element) => ({ whiteSpace: getComputedStyle(element).whiteSpace, height: element.getBoundingClientRect().height, clipped: element.scrollWidth > element.clientWidth + 1 }));
  expect(wrap.whiteSpace).toBe("normal");
  expect(wrap.height).toBeGreaterThan(21);
  expect(wrap.clipped).toBe(false);
  expect(await cells.nth(3).locator(".ui-table-cell-text__primary").evaluate((element) => getComputedStyle(element).fontWeight)).toBe("600");
  await expect(cells.nth(4).locator(".ui-table-cell-text__secondary")).toHaveText("0");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("320px table keeps readable primary text and confines horizontal scrolling while actions remain usable", async ({ page }) => {
  const { preview, table } = await typographyCase(page, 320);
  const scroller = preview.locator('[data-ui-owner="DataTable"] .ui-data-table__scroller');
  await expect(scroller).toHaveAttribute("role", "region");
  await expect(scroller).toHaveAttribute("tabindex", "0");
  const geometry = await scroller.evaluate((element) => ({ overflow: element.scrollWidth > element.clientWidth, width: element.getBoundingClientRect().width }));
  expect(geometry.overflow).toBe(true);
  expect(geometry.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const styles = await primaryStyles(table.locator("tbody .ui-table-cell-text__primary"));
  expect(styles.every((style) => style.size === "14px" && style.lineHeight === "21px")).toBe(true);
  await preview.screenshot({ path: test.info().outputPath("table-typography-320.png"), animations: "disabled" });
  await table.getByRole("button", { name: "查看任务 26090817113818751879", exact: true }).click();
  await expect(page.locator(".ui-toast")).toContainText("已选择任务 26090817113818751879");
});

test("dark and locale table examples preserve typography and business values", async ({ page }) => {
  const { casePanel, table } = await typographyCase(page);
  const light = await table.locator("tbody .ui-table-cell-text__primary").first().evaluate((element) => ({
    color: getComputedStyle(element).color,
    font: getComputedStyle(element).fontFamily,
  }));
  await casePanel.getByRole("tab", { name: "深色模式", exact: true }).click();
  const darkTable = casePanel.getByRole("table", { name: "任务数据正文排版", exact: true });
  const darkPrimary = darkTable.locator("tbody .ui-table-cell-text__primary").first();
  const dark = await darkPrimary.evaluate((element) => ({ color: getComputedStyle(element).color, font: getComputedStyle(element).fontFamily }));
  expect(dark.color).not.toBe(light.color);
  expect(dark.font).toBe(light.font);
  const darkStyles = await primaryStyles(darkTable.locator("tbody .ui-table-cell-text__primary"));
  expect(darkStyles.every((style) => style.size === "14px" && style.weight === "400" && style.lineHeight === "21px")).toBe(true);
  await expect(darkPrimary).toHaveText("26090817113818751879");
  await casePanel.getByRole("tab", { name: "多语言", exact: true }).click();
  const englishTable = casePanel.getByRole("table", { name: "任务数据正文排版", exact: true });
  await expect(englishTable.locator("tbody .ui-table-cell-text__primary").first()).toHaveText("26090817113818751879");
  await expect(casePanel.getByRole("button", { name: "Next page", exact: true })).toBeDisabled();
  const englishStyles = await primaryStyles(englishTable.locator("tbody .ui-table-cell-text__primary"));
  expect(englishStyles.every((style) => style.font === light.font && style.size === "14px" && style.lineHeight === "21px")).toBe(true);
});
