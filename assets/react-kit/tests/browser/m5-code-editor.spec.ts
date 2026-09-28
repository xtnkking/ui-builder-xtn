// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["CodeEditor"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("CodeEditor default Tab exits and opt-in indent mode has a keyboard exit", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-code-editor.html");
  const plain = page.getByRole("textbox", { name: "Plain editor" });
  const indent = page.getByRole("textbox", { name: "Indent editor" });
  const after = page.getByRole("button", { name: "After editor" });

  await plain.focus();
  await page.keyboard.press("Tab");
  await expect(indent).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(plain).toBeFocused();
  await expect(plain).toHaveValue("plain");

  await indent.focus();
  await indent.evaluate((editor: HTMLTextAreaElement) => editor.setSelectionRange(1, 12));
  await page.keyboard.press("Tab");
  await expect(indent).toBeFocused();
  await expect(indent).toHaveValue("  first\n  second\nthird");
  await indent.evaluate((editor: HTMLTextAreaElement) => editor.setSelectionRange(1, 16));
  await page.keyboard.press("Shift+Tab");
  await expect(indent).toHaveValue("first\nsecond\nthird");
  await page.keyboard.press("Control+m");
  await expect(indent).toHaveAttribute("aria-describedby", /.+/);
  await page.keyboard.press("Tab");
  await expect(after).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(indent).toBeFocused();
});

test("CodeEditor has no serious accessibility violations in both Tab modes", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-code-editor.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
