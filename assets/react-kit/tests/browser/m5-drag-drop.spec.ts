// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["DragDrop"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("DragDrop independently owns Enter and Space file selection, filtering, reselection, Tab exit and disabled state", async ({ page }) => {
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
  const browse = group.getByRole("button", { name: "Choose files with keyboard" });
  await expect(group.getByRole("button")).toHaveCount(1);
  await expect(group.locator("input[type=file]")).toHaveAttribute("tabindex", "-1");
  await page.getByRole("button", { name: "Before files" }).focus();
  await page.keyboard.press("Tab");
  await expect(browse).toBeFocused();
  for (const key of ["Enter", "Space"]) {
    // OS dialog focus restoration is outside browser automation; establish the actual browser anchor explicitly.
    await browse.focus();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press(key);
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(true);
    await chooser.setFiles([
      { name: "chosen.svg", mimeType: "text/plain", buffer: Buffer.from("svg") },
      { name: "mime.bin", mimeType: "image/png", buffer: Buffer.from("image") },
      { name: "denied.txt", mimeType: "text/plain", buffer: Buffer.from("text") },
    ]);
    await expect(page.getByLabel("Accepted files")).toHaveText("chosen.svg, mime.bin");
    await expect(page.getByLabel("Rejected files")).toHaveText("denied.txt");
    await expect(group.locator("input[type=file]")).toHaveValue("");
  }
  await browse.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "After files" })).toBeFocused();
  const lock = page.getByRole("switch", { name: "Disable file selection" });
  await lock.focus();
  await page.keyboard.press("Space");
  await expect(browse).toBeDisabled();
  await expect(group.locator("input[type=file]")).toBeDisabled();
  await group.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["blocked"], "blocked.png", { type: "image/png" }));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.getByLabel("Accepted files")).toHaveText("chosen.svg, mime.bin");
});

test("DragDrop region has no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-drag-drop.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
