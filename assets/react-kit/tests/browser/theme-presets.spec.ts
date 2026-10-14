// @ui-coverage {"kind":"browser","runner":"browser","exports":["ThemeProvider"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

function contrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unsupported computed color: ${color}`);
    const linear = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
    });
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  };
  const firstValue = luminance(first);
  const secondValue = luminance(second);
  return (Math.max(firstValue, secondValue) + .05) / (Math.min(firstValue, secondValue) + .05);
}

test.describe("official theme preview", () => {
  test.setTimeout(60_000);
  test.use({ viewport: { width: 1440, height: 1100 }, actionTimeout: 8_000 });

  const themeRoot = (page: Page) => page.locator('[data-ui-owner="ThemeProvider"]').first();
  const workspaceCard = (page: Page) => page.getByRole("region", { name: "协作工作台预览" }).locator('[data-ui-owner="Card"]').first();

  async function assertAppearance(surface: Locator, expected: { preset: string; material: string; mode: string; primary: string }) {
    await expect.poll(() => surface.evaluate((element) => {
      const root = element.closest<HTMLElement>(".ui-portal") ?? element as HTMLElement;
      const style = getComputedStyle(element);
      return {
        preset: root.getAttribute("data-theme-preset"),
        material: root.getAttribute("data-theme-material"),
        mode: root.getAttribute("data-color-scheme"),
        primary: style.getPropertyValue("--ui-primary").trim(),
      };
    })).toEqual(expected);
  }

  test("switches official presets, materials, color sets and live code", async ({ page }, testInfo) => {
    await page.goto("/#/themes");
    await expect(page.getByRole("heading", { level: 1, name: "主题与材质" })).toBeVisible();
    const root = themeRoot(page);
    await expect(root).toHaveAttribute("data-theme-preset", "apple");
    await expect(root).toHaveAttribute("data-theme-material", "glass");
    await expect(page.getByRole("combobox", { name: /^主题强调色/ })).toHaveText("跟随风格");
    const appleSurface = await workspaceCard(page).evaluate((element) => ({ radius: getComputedStyle(element).borderRadius, blur: getComputedStyle(element).backdropFilter }));
    expect(appleSurface.radius).toBe("20px");
    expect(appleSurface.blur).not.toBe("none");
    const primaryButton = page.getByRole("button", { name: "新建项目", exact: true });
    await expect(primaryButton).toHaveCSS("background-color", "rgb(0, 102, 204)");
    const appleColors = await primaryButton.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color }));
    expect(contrastRatio(appleColors.background, appleColors.text)).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath("theme-apple-glass-desktop.png"), fullPage: true });

    await page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: "默认", exact: true }).click();
    await expect(root).toHaveAttribute("data-theme-preset", "default");
    await expect.poll(() => workspaceCard(page).evaluate((element) => getComputedStyle(element).borderRadius)).toBe("8px");
    await page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: "Material", exact: true }).click();
    await page.getByRole("group", { name: "表面材质", exact: true }).getByRole("button", { name: "实色", exact: true }).click();
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    await expect(root).toHaveAttribute("data-theme-preset", "material");
    await expect(root).toHaveAttribute("data-theme-material", "solid");
    await expect(root).toHaveAttribute("data-color-scheme", "dark");
    await expect.poll(() => workspaceCard(page).evaluate((element) => getComputedStyle(element).borderRadius)).toBe("16px");
    await expect.poll(() => workspaceCard(page).evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
    await expect(primaryButton).toHaveCSS("background-color", "rgb(208, 188, 255)");
    const materialColors = await primaryButton.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color }));
    expect(contrastRatio(materialColors.background, materialColors.text)).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath("theme-material-solid-dark-desktop.png"), fullPage: true });

    await page.getByRole("combobox", { name: /^主题强调色/ }).click();
    await page.getByRole("option", { name: "松绿", exact: true }).click();
    await expect.poll(() => root.evaluate((element) => getComputedStyle(element).getPropertyValue("--ui-primary").trim())).toBe("#74d8b5");
    await expect(page.getByRole("button", { name: "新建项目", exact: true })).toHaveCSS("background-color", "rgb(116, 216, 181)");
    await expect(page.getByRole("region", { name: "tsx 代码" })).toContainText('preset="material"');
    await expect(page.getByRole("region", { name: "tsx 代码" })).toContainText('"--ui-primary": "#74d8b5"');
  });

  test("inherits the selected theme through dialog, drawer and nested select portals", async ({ page }) => {
    await page.goto("/#/themes");
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    await page.getByRole("combobox", { name: /^主题强调色/ }).click();
    await page.getByRole("option", { name: "鸢紫", exact: true }).click();
    const expected = { preset: "apple", material: "glass", mode: "dark", primary: "#c6a7ff" };
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建团队项目", exact: true });
    await expect(dialog).toBeVisible();
    await assertAppearance(dialog, expected);
    expect(await dialog.evaluate((element) => !document.querySelector('[data-ui-owner="ThemeProvider"]')!.contains(element))).toBe(true);
    await expect(dialog.getByRole("button", { name: "创建项目", exact: true })).toHaveCSS("background-color", "rgb(198, 167, 255)");
    await dialog.getByRole("combobox", { name: /^项目负责人/ }).click();
    const list = page.getByRole("listbox", { name: "项目负责人", exact: true });
    await expect(list).toBeVisible();
    await assertAppearance(list, expected);
    expect(await list.evaluate((element) => !document.querySelector('[data-ui-owner="Dialog"]')!.contains(element))).toBe(true);
    await list.getByRole("option", { name: "陈宇 · 产品经理", exact: true }).click();
    await dialog.getByRole("textbox", { name: /^项目名称/ }).fill("秋季体验探索");
    await dialog.getByRole("button", { name: "创建项目", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("table", { name: "示例团队项目", exact: true })).toContainText("秋季体验探索");
    await page.getByRole("button", { name: "空间设置", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "空间偏好设置", exact: true });
    await expect(drawer).toBeVisible();
    await assertAppearance(drawer, expected);
    await expect(drawer.getByRole("button", { name: "完成设置", exact: true })).toHaveCSS("background-color", "rgb(198, 167, 255)");
    await drawer.getByRole("switch", { name: "每周工作摘要", exact: true }).check();
    await drawer.getByRole("button", { name: "完成设置", exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "空间设置", exact: true })).toBeFocused();
  });

  test("keeps the dark glass workbench and overlays within a 320px viewport", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto("/#/themes");
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    await expect(themeRoot(page)).toHaveAttribute("data-color-scheme", "dark");
    await expect.poll(() => page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ client: 320, scroll: 320 });
    const styleButton = page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: "Material", exact: true });
    const buttonBox = await styleButton.boundingBox();
    expect(buttonBox!.width).toBeGreaterThan(48);
    expect(buttonBox!.height).toBeLessThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath("theme-apple-glass-dark-320.png"), fullPage: true });
    await page.emulateMedia({ forcedColors: "active" });
    await expect.poll(() => workspaceCard(page).evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
    await page.emulateMedia({ forcedColors: "none" });
    await expect.poll(() => workspaceCard(page).evaluate((element) => getComputedStyle(element).backdropFilter)).not.toBe("none");
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建团队项目", exact: true });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);
    await dialog.getByRole("combobox", { name: /^项目负责人/ }).click();
    const list = page.getByRole("listbox", { name: "项目负责人", exact: true });
    await expect(list).toBeVisible();
    const listBox = await list.boundingBox();
    expect(listBox!.x).toBeGreaterThanOrEqual(0);
    expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "新建项目", exact: true })).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });

  test("keeps unconfigured component routes unchanged after leaving the preview", async ({ page }) => {
    await page.goto("/#/components/button");
    const button = page.getByRole("button", { name: "保存更改", exact: true }).first();
    await expect(button).toBeVisible();
    const readButton = () => button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { height: style.height, radius: style.borderRadius, background: style.backgroundColor, color: style.color };
    });
    const baseline = await readButton();
    await page.getByRole("link", { name: "主题预览", exact: true }).click();
    await expect(page).toHaveURL(/#\/themes$/);
    await page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: "Material", exact: true }).click();
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    await page.getByRole("link", { name: "组件目录", exact: true }).click();
    await expect(page).toHaveURL(/#\/components\/button$/);
    await expect(page.getByRole("heading", { level: 1, name: /^按钮\s*Button$/ })).toBeVisible();
    await expect.poll(readButton).toEqual(baseline);
    await expect(page.locator('.theme-preview-page')).toHaveCount(0);
    await expect(page.locator('[data-theme-preset="material"]')).toHaveCount(0);
  });

  test("matches dropdown selection corners to the preset and keeps mobile highlights inset", async ({ page }, testInfo) => {
    await page.goto("/#/themes");
    const trigger = page.getByRole("combobox", { name: /^筛选示例项目状态/ });
    for (const preset of [
      { label: "默认", outer: 8, inner: 6 },
      { label: "苹果", outer: 20, inner: 14 },
      { label: "Material", outer: 16, inner: 10 },
    ]) {
      await page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: preset.label, exact: true }).click();
      await trigger.click();
      const menu = page.getByRole("listbox", { name: "筛选示例项目状态", exact: true });
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS("border-top-left-radius", `${preset.outer}px`);
      await expect(menu.getByRole("option").first()).toHaveCSS("border-radius", `${preset.inner}px`);
      await expect(menu.getByRole("option").last()).toHaveCSS("border-radius", `${preset.inner}px`);
      if (preset.label === "苹果") {
        await page.screenshot({ path: testInfo.outputPath("apple-selected-menu-desktop.png") });
      }
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    await page.setViewportSize({ width: 320, height: 780 });
    await page.getByRole("group", { name: "设计风格", exact: true }).getByRole("button", { name: "苹果", exact: true }).click();
    await page.getByRole("group", { name: "显示模式", exact: true }).getByRole("button", { name: "深色", exact: true }).click();
    await trigger.click();
    const menu = page.getByRole("listbox", { name: "筛选示例项目状态", exact: true });
    const last = menu.getByRole("option").last();
    await last.hover();
    await expect(last).toHaveCSS("border-radius", "14px");
    await expect(last).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const bounds = await menu.evaluate((element) => {
      const outer = element.getBoundingClientRect();
      const last = element.querySelector('[role="option"]:last-child')!.getBoundingClientRect();
      return { left: outer.left, right: outer.right, insetLeft: last.left - outer.left, insetBottom: outer.bottom - last.bottom };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(320);
    expect(bounds.insetLeft).toBeGreaterThanOrEqual(6);
    expect(bounds.insetBottom).toBeGreaterThanOrEqual(6);
    await page.screenshot({ path: testInfo.outputPath("apple-hovered-menu-dark-320.png") });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
});
