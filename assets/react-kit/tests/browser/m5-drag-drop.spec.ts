// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["DragDrop"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("DragDrop filters native file drops and FileUpload remains the keyboard browse path", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-drag-drop.html");
  const group = page.getByRole("group", { name: "Image drop area" });
  await group.evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(new File(["ok"], "photo.png", { type: "image/png" }));
    data.items.add(new File(["bad"], "report.pdf", { type: "application/pdf" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  await expect(page.getByLabel("Accepted files")).toHaveText("photo.png");
  await expect(page.getByLabel("Rejected files")).toHaveText("report.pdf");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Choose files with keyboard" })).toBeFocused();
});

test("DragDrop region has no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-drag-drop.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
