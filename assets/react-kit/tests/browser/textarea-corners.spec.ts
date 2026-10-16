// @ui-coverage {"kind":"browser","runner":"browser","exports":["Textarea","CodeEditor","MarkdownEditor","RichTextEditor"]}
import { expect, test, type Locator, type Page } from "@playwright/test";

async function selectState(page: Page, label: string) {
  await page.getByRole("tab", { name: label, exact: true }).click();
  return page.getByRole("tabpanel", { name: label, exact: true }).locator(".demo-explorer-preview");
}

async function assertRoundedFrame(textarea: Locator) {
  const shell = textarea.locator("..");
  await expect(shell).toHaveClass(/ui-textarea-shell/);
  await expect(shell).toHaveCSS("overflow-x", "hidden");
  await expect(shell).toHaveCSS("overflow-y", "hidden");
  const geometry = await textarea.evaluate((node) => {
    const input = node as HTMLTextAreaElement;
    const parent = input.parentElement!;
    const outerStyle = getComputedStyle(parent);
    const inputStyle = getComputedStyle(input);
    const outer = parent.getBoundingClientRect();
    const inner = input.getBoundingClientRect();
    return {
      radii: [outerStyle.borderTopLeftRadius, outerStyle.borderTopRightRadius, outerStyle.borderBottomRightRadius, outerStyle.borderBottomLeftRadius].map(parseFloat),
      borders: [outerStyle.borderTopWidth, outerStyle.borderRightWidth, outerStyle.borderBottomWidth, outerStyle.borderLeftWidth].map(parseFloat),
      styles: [outerStyle.borderTopStyle, outerStyle.borderRightStyle, outerStyle.borderBottomStyle, outerStyle.borderLeftStyle],
      innerBorder: inputStyle.borderTopWidth,
      insets: [inner.left - outer.left, inner.top - outer.top, outer.right - inner.right, outer.bottom - inner.bottom],
      scrollable: input.scrollHeight > input.clientHeight,
    };
  });
  for (const radius of geometry.radii) expect(radius).toBeGreaterThan(0);
  for (const border of geometry.borders) expect(border).toBe(1);
  expect(geometry.styles).toEqual(["solid", "solid", "solid", "solid"]);
  expect(geometry.innerBorder).toBe("0px");
  for (const inset of geometry.insets) expect(inset).toBeCloseTo(1, 0);
  expect(geometry.scrollable).toBe(true);
  await expect(textarea).toHaveCSS("overflow-y", "auto");
  await expect(textarea).toHaveCSS("resize", "vertical");
  return shell;
}

test("@textarea-corners long native text keeps its rounded frame while scrolling and resizing on desktop and mobile", async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/components/textarea");
    const preview = await selectState(page, "长内容");
    const textarea = preview.getByRole("textbox", { name: "长说明", exact: true });
    await expect(textarea).toBeVisible();
    const shell = await assertRoundedFrame(textarea);
    await textarea.scrollIntoViewIfNeeded();
    await textarea.focus();
    await textarea.press("Control+Home");
    expect(await textarea.evaluate((node) => (node as HTMLTextAreaElement).selectionStart)).toBe(0);
    const topBeforeWheel = await textarea.evaluate((node) => node.scrollTop);
    await textarea.hover();
    await page.mouse.wheel(0, 180);
    await expect.poll(() => textarea.evaluate((node) => node.scrollTop)).toBeGreaterThan(topBeforeWheel);
    await textarea.press("Control+End");
    await expect.poll(() => textarea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect(await textarea.evaluate((node) => (node as HTMLTextAreaElement).selectionStart)).toBe((await textarea.inputValue()).length);

    if (width === 1280) {
      // Drag the browser's real native resize grip; never synthesize dimensions.
      await textarea.scrollIntoViewIfNeeded();
      const before = (await textarea.boundingBox())!;
      await page.mouse.move(before.x + before.width - 5, before.y + before.height - 5);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width - 5, before.y + before.height + 59, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => (await textarea.boundingBox())!.height).toBeGreaterThan(before.height + 40);
      expect((await textarea.boundingBox())!.width).toBeCloseTo(before.width, 0);
      await assertRoundedFrame(textarea);
    }
    await shell.screenshot({ path: test.info().outputPath(`textarea-rounded-${width}.png`), animations: "disabled" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await textarea.press("Tab");
    await expect(textarea).not.toBeFocused();
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const darkPreview = await selectState(page, "深色模式");
  const darkTextarea = darkPreview.getByRole("textbox", { name: "深色说明", exact: true });
  await assertRoundedFrame(darkTextarea);
  await darkPreview.screenshot({ path: test.info().outputPath("textarea-rounded-dark.png"), animations: "disabled" });
});

test("@textarea-corners validation overlay and editor compositions retain focus semantics and their original styling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/#/components/textarea");
  const validation = await selectState(page, "校验");
  const invalid = validation.getByRole("textbox", { name: "校验失败的说明", exact: true });
  await expect(invalid).toHaveAttribute("aria-invalid", "true");
  await expect(invalid).toHaveAccessibleDescription("请补充变更原因。");
  await invalid.focus();
  await expect(invalid).toBeFocused();
  const errorColor = await validation.getByRole("alert").evaluate((node) => getComputedStyle(node).color);
  await expect(invalid.locator("..")).toHaveCSS("border-top-color", errorColor);
  await invalid.press("A");
  await expect(invalid).toHaveValue("A");
  await validation.screenshot({ path: test.info().outputPath("textarea-invalid-focus.png"), animations: "disabled" });

  const overlay = await selectState(page, "浮层交互");
  const trigger = overlay.getByRole("button", { name: "在弹窗中查看此状态", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "浮层内的组件", exact: true });
  await expect(dialog.locator("..")).toHaveAttribute("data-ui-motion", "open");
  const modalTextarea = dialog.getByRole("textbox", { name: "浮层内的说明", exact: true });
  await modalTextarea.focus();
  await expect(modalTextarea).toBeFocused();
  await assertRoundedFrame(modalTextarea);
  await modalTextarea.press("Control+End");
  await expect.poll(() => modalTextarea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await dialog.screenshot({ path: test.info().outputPath("textarea-rounded-dialog.png"), animations: "disabled" });
  await modalTextarea.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.goto("/#/components/code-editor");
  const codePreview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  const code = codePreview.getByRole("textbox", { name: "默认焦点导航", exact: true });
  await expect(code.locator("..")).toHaveCSS("border-top-width", "0px");
  await expect(code.locator("..")).toHaveCSS("border-top-left-radius", "0px");
  await expect(code.locator("../..")).toHaveCSS("border-top-width", "1px");
  expect(await code.evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Cascadia Code");
  await expect(code).toHaveCSS("min-height", "104px");
  await code.focus();
  await code.press("Tab");
  await expect(codePreview.getByRole("textbox", { name: "可退出的 Tab 缩进", exact: true })).toBeFocused();

  await page.goto("/#/components/markdown-editor");
  const markdownPreview = page.getByRole("tabpanel", { name: "总览", exact: true }).locator(".demo-explorer-preview");
  for (const label of ["Markdown 内容", "旧名称兼容示例"]) {
    const editor = markdownPreview.getByRole("textbox", { name: label, exact: true });
    await expect(editor.locator("..")).toHaveCSS("border-top-width", "0px");
    await expect(editor.locator("..")).toHaveCSS("border-top-left-radius", "0px");
    await expect(editor.locator("../..")).toHaveCSS("border-top-width", "1px");
    expect(await editor.evaluate((node) => getComputedStyle(node).fontFamily)).not.toContain("Cascadia Code");
    await editor.fill("已编辑的发布说明");
    await expect(editor).toHaveValue("已编辑的发布说明");
  }
  await markdownPreview.screenshot({ path: test.info().outputPath("textarea-editor-compositions.png"), animations: "disabled" });
});
