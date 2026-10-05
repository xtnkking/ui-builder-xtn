// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["MarkdownEditor","RichTextEditor"]}
import { expect, test } from "@playwright/test";

test("MarkdownEditor edits source while the deprecated alias remains usable", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => { if (message.type() === "warning") warnings.push(message.text()); });
  await page.goto("/tests/fixtures/m5-markdown-editor.html");
  const form = page.getByRole("form", { name: "Notes" });
  const editor = form.getByRole("textbox", { name: "Markdown source" });
  await expect(editor).toHaveAttribute("data-pui-owner", "MarkdownEditor");
  await expect(form.getByRole("textbox", { name: "Legacy source" })).toHaveAttribute("data-pui-owner", "RichTextEditor");
  await expect.poll(() => warnings.some((warning) => warning.includes("use MarkdownEditor"))).toBe(true);
  await editor.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(6, 11));
  await form.locator('[data-pui-owner="MarkdownEditor"]').getByRole("button", { name: "粗体" }).click();
  await expect(editor).toHaveValue("Hello **world**");
  await expect(editor).toBeFocused();
  await expect(page.getByTestId("source-value")).toHaveText("Hello **world**");
  expect(await form.evaluate((element) => Array.from(new FormData(element as HTMLFormElement).entries()))).toEqual([
    ["markdown", "Hello **world**"],
    ["legacy", "Old source"],
  ]);
  await expect(form.locator('[data-pui-owner="MarkdownEditor"] strong')).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle disabled" }).click();
  await expect(editor).toBeDisabled();
  await expect(form.locator('[data-pui-owner="MarkdownEditor"]').getByRole("button", { name: "粗体" })).toBeDisabled();
  expect(await form.evaluate((element) => Array.from(new FormData(element as HTMLFormElement).entries()))).toEqual([
    ["legacy", "Old source"],
  ]);
});

test("Markdown toolbar is reachable by Tab and returns focus after keyboard activation", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-markdown-editor.html");
  const editor = page.getByRole("textbox", { name: "Markdown source" });
  const bold = page.locator('[data-pui-owner="MarkdownEditor"]').getByRole("button", { name: "粗体" });
  await expect(bold).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(bold).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("**文本**Hello world");
  await editor.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await bold.focus();
  await page.keyboard.press("Space");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("**文本**Hello world**文本**");
});
