import axeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const blockingImpacts = new Set(["critical", "serious"]);

async function expectNoBlockingViolations(page: Page, surface: string) {
  const results = await new axeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) => (
    violation.impact != null && blockingImpacts.has(violation.impact)
  ));
  const details = blocking.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));

  expect(details, `${surface} contains critical or serious axe violations`).toEqual([]);
}

async function openExample(page: Page, route: string) {
  await page.goto(route);
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

test.describe("Personal UI example accessibility", () => {
  test("member management has no blocking automated violations", async ({ page }) => {
    await openExample(page, "/#/patterns/list-filter");
    await expect(page.getByRole("tab", { name: "列表管理", exact: true })).toBeVisible();
    await expectNoBlockingViolations(page, "member management");
  });

  test("family login has no blocking automated violations", async ({ page }) => {
    await openExample(page, "/#/patterns/authentication");
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
    await expectNoBlockingViolations(page, "family login");
  });

  test("family login visual slot keeps contrast at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 736, height: 900 });
    await openExample(page, "/#/patterns/authentication");
    await expect(page.locator(".pui-auth__scene").first()).toHaveCSS("opacity", "1");
    await expectNoBlockingViolations(page, "family login at 736px");
  });

  test("required field markers have determinate contrast at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 736, height: 900 });
    await openExample(page, "/#/components/field");
    await page.addStyleTag({ content: "#root { background: #f4f7f6; }" });
    const markers = page.locator(".pui-label__required");
    await expect(markers.first()).toHaveCSS("background-color", "rgb(247, 248, 250)");
    const results = await new axeBuilder({ page }).analyze();
    const blocking = [...results.violations, ...results.incomplete]
      .filter((rule) => rule.impact != null && blockingImpacts.has(rule.impact))
      .flatMap((rule) => rule.nodes
        .filter((node) => node.target.some((target) => target.includes(".pui-label__required")))
        .map((node) => ({ id: rule.id, target: node.target })));
    expect(blocking).toEqual([]);
  });

  test("number inputs have no blocking automated violations", async ({ page }) => {
    await openExample(page, "/#/components/number");
    await expect(page.getByRole("heading", { name: "数字步进输入", exact: true })).toBeVisible();
    await expectNoBlockingViolations(page, "number inputs");
  });

  test("empty Textarea has determinate contrast and no horizontal overflow at 2560px", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 900 });
    await openExample(page, "/#/components/textarea");
    const textarea = page.locator("#explorer-textarea");
    await expect(textarea).toHaveAttribute("data-pui-owner", "Textarea");
    await textarea.fill("");
    await expect(textarea).toHaveValue("");
    await expect(textarea).toHaveCSS("overflow-x", "hidden");
    await expect(textarea).toHaveCSS("overflow-y", "auto");

    const results = await new axeBuilder({ page }).include("#explorer-textarea").analyze();
    expect(results.incomplete.filter((rule) => rule.id === "color-contrast")).toEqual([]);
    expect(results.violations.filter((rule) => rule.impact === "critical" || rule.impact === "serious")).toEqual([]);
  });

  test("paginated data table has no blocking automated violations", async ({ page }) => {
    await openExample(page, "/#/components/data-table");
    await expect(page.getByRole("table", { name: "账户列表" })).toBeVisible();
    await expectNoBlockingViolations(page, "paginated data table");
  });

  test("dialog content has no blocking automated violations", async ({ page }) => {
    await openExample(page, "/#/components/dialog");
    await page.getByRole("button", { name: "编辑项目" }).click();
    await expect(page.getByRole("dialog", { name: /编辑项目/ })).toBeVisible();
    await expectNoBlockingViolations(page, "dialog content");
  });
});
