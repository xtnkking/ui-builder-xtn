// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["DragDrop","FileUpload"]}
import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type FixtureFile = { name: string; mimeType: string; content: string };

async function chooseWithKeyboard(page: Page, files: FixtureFile[]) {
  const browse = page.getByRole("button", { name: "选择CSV文件" });
  await browse.focus();
  const chooserEvent = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  const chooser = await chooserEvent;
  await chooser.setFiles(files.map(({ name, mimeType, content }) => ({ name, mimeType, buffer: Buffer.from(content) })));
}

async function dropFiles(target: Locator, files: FixtureFile[]) {
  await target.evaluate((element, incoming) => {
    const transfer = new DataTransfer();
    incoming.forEach(({ name, mimeType, content }) => transfer.items.add(new File([content], name, { type: mimeType })));
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, files);
}

test("D2 keyboard activates chooser, removes a queued file and leaves the official composition", async ({ page }) => {
  await page.goto("/tests/fixtures/d2-drag-upload.html");
  const lock = page.getByRole("switch", { name: "锁定文件操作" });
  const browse = page.getByRole("button", { name: "选择CSV文件" });
  await expect(lock).toBeVisible();
  await expect(browse).toBeEnabled();
  // Establish a mounted browser focus anchor; page-load Tab policy is not the contract.
  // The actual next Tab must still reach browse before Enter activates the chooser.
  await lock.focus();
  await expect(lock).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(browse).toBeFocused();
  await chooseWithKeyboard(page, [{ name: "keyboard.csv", mimeType: "text/csv", content: "abc" }]);
  const upload = page.locator("[data-pui-owner='FileUpload']");
  await expect(upload.getByRole("listitem")).toHaveText(/keyboard.csv.*3 B/s);
  await expect(upload.locator("[data-status='queued']")).toHaveCount(1);
  // Re-establish browser focus explicitly; this does not certify OS-dialog focus restoration.
  await browse.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "移除 keyboard.csv" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(upload.getByRole("listitem")).toHaveCount(0);
  const exit = page.getByRole("button", { name: "离开文件清单" });
  for (let step = 0; step < 4 && !(await exit.evaluate((element) => element === document.activeElement)); step += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(exit).toBeFocused();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("D2 both entry points preserve accept OR, share rejections and keep same-name identities separate", async ({ page }) => {
  const keyWarnings: string[] = [];
  page.on("console", (event) => { if (/same key|unique.*key/i.test(event.text())) keyWarnings.push(event.text()); });
  await page.goto("/tests/fixtures/d2-drag-upload.html");
  await chooseWithKeyboard(page, [
    { name: "same.csv", mimeType: "text/plain", content: "aa" },
    { name: "mime.txt", mimeType: "text/csv", content: "b" },
    { name: "denied.txt", mimeType: "text/plain", content: "x" },
  ]);
  const upload = page.locator("[data-pui-owner='FileUpload']");
  await expect(upload.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("alert", { name: "文件拒绝反馈" })).toContainText("denied.txt");
  await dropFiles(page.getByRole("group", { name: "接收CSV文件" }), [
    { name: "same.csv", mimeType: "application/octet-stream", content: "bbbbbb" },
    { name: "drop.bin", mimeType: "text/csv", content: "c" },
    { name: "denied.png", mimeType: "image/png", content: "y" },
  ]);
  await expect(upload.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("alert", { name: "文件拒绝反馈" })).toContainText("denied.png");
  await expect(upload.getByText("denied.txt", { exact: true })).toHaveCount(0);
  await expect(upload.getByText("denied.png", { exact: true })).toHaveCount(0);
  await upload.getByRole("button", { name: "移除 same.csv" }).first().press("Enter");
  await expect(upload.getByRole("listitem")).toHaveCount(3);
  await expect(upload.getByRole("button", { name: "移除 same.csv" })).toHaveCount(1);
  await expect(upload.getByRole("listitem").filter({ hasText: "same.csv" })).toHaveText(/same.csv.*6 B/s);
  expect(keyWarnings).toEqual([]);
});

test("D2 shared disabled state blocks browse, both drop surfaces and removal until unlocked", async ({ page }) => {
  await page.goto("/tests/fixtures/d2-drag-upload.html");
  await chooseWithKeyboard(page, [{ name: "retained.csv", mimeType: "text/csv", content: "a" }]);
  const lock = page.getByRole("switch", { name: "锁定文件操作" });
  await lock.focus();
  await page.keyboard.press("Space");
  const upload = page.locator("[data-pui-owner='FileUpload']");
  await expect(lock).toBeChecked();
  await expect(page.getByRole("button", { name: "选择CSV文件" })).toBeDisabled();
  await expect(upload.locator("input[type=file]")).toBeDisabled();
  const remove = page.getByRole("button", { name: "移除 retained.csv" });
  await expect(remove).toBeDisabled();
  const blocked = [
    { name: "blocked.csv", mimeType: "text/csv", content: "b" },
    { name: "blocked.png", mimeType: "image/png", content: "x" },
  ];
  await dropFiles(page.getByRole("group", { name: "接收CSV文件" }), blocked);
  await dropFiles(upload.locator(".pui-file-upload__dropzone"), blocked);
  await remove.evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await expect(upload.getByRole("listitem")).toHaveCount(1);
  await expect(upload.getByRole("listitem")).toContainText("retained.csv");
  await expect(page.getByRole("alert", { name: "文件拒绝反馈" })).toHaveCount(0);
  await lock.focus();
  await page.keyboard.press("Space");
  await expect(remove).toBeEnabled();
  await remove.press("Enter");
  await expect(upload.getByRole("listitem")).toHaveCount(0);
});
