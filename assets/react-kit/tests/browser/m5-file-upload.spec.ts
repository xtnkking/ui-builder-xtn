// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["FileUpload"]}
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("FileUpload submits only completed values and requires a completed item", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-file-upload.html");
  const form = page.getByRole("form", { name: "Documents" });
  const readForm = () => form.evaluate((element) => ({
    entries: Array.from(new FormData(element as HTMLFormElement).entries()),
    valid: (element as HTMLFormElement).checkValidity(),
  }));

  expect(await readForm()).toEqual({ entries: [["documents", "remote/complete"]], valid: true });
  await page.getByRole("button", { name: "Remove success" }).click();
  expect(await readForm()).toEqual({ entries: [], valid: false });
  await form.evaluate((element) => (element as HTMLFormElement).reportValidity());
  await expect(form.locator(".pui-file-upload__dropzone > .pui-button")).toBeFocused();
  await form.evaluate((element) => (element as HTMLFormElement).reset());
  await expect.poll(readForm).toEqual({ entries: [["documents", "remote/complete"]], valid: true });
});

test("selection and drop validate files but leave upload status to the owner", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-file-upload.html");
  const upload = page.locator("[data-pui-owner='FileUpload']");
  await upload.locator("input[type=file]").setInputFiles({ name: "picked.png", mimeType: "image/png", buffer: Buffer.from("ok") });
  await expect(page.getByTestId("selected-names")).toHaveText("picked.png");
  await expect(upload.locator(".pui-file-upload__item")).toHaveCount(4);

  await upload.locator(".pui-file-upload__dropzone").evaluate((zone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["ok"], "good.png", { type: "image/png" }));
    transfer.items.add(new File(["bad"], "bad.txt", { type: "text/plain" }));
    transfer.items.add(new File(["large"], "large.png", { type: "image/png" }));
    transfer.items.add(new File(["ok"], "another.png", { type: "image/png" }));
    transfer.items.add(new File(["ok"], "extra.png", { type: "image/png" }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.getByTestId("selected-names")).toHaveText("good.png,another.png");
  await expect(page.getByTestId("rejection-reasons")).toHaveText("type,size,count");
  await expect(upload.locator(".pui-file-upload__item")).toHaveCount(4);
  await page.getByRole("button", { name: "开始上传" }).click();
  await page.getByRole("button", { name: "重试 failed.txt" }).click();
  await expect(page.getByTestId("start-count")).toHaveText("1");
  await expect(page.getByTestId("retry-count")).toHaveText("1");
  await expect(upload.locator(".pui-file-upload__item[data-status='queued']")).toHaveCount(1);
  await expect(upload.locator(".pui-file-upload__item[data-status='error']")).toHaveCount(1);
});

test("disabled upload blocks every action and omits form data", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-file-upload.html");
  const form = page.getByRole("form", { name: "Documents" });
  const upload = page.locator("[data-pui-owner='FileUpload']");
  await page.getByRole("button", { name: "Toggle disabled" }).click();
  await expect(upload.getByRole("button", { name: "重试 failed.txt" })).toBeDisabled();
  await expect(upload.getByRole("button", { name: "移除 failed.txt" })).toBeDisabled();
  await expect(upload.getByRole("button", { name: "移除 complete.txt" })).toBeDisabled();
  await expect(upload.locator(".pui-file-upload__dropzone > .pui-button")).toBeDisabled();
  await expect(upload.getByRole("button", { name: "开始上传" })).toBeDisabled();
  await upload.locator(".pui-file-upload__dropzone").evaluate((zone) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["ok"], "disabled.png", { type: "image/png" }));
    zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.getByTestId("selected-names")).toBeEmpty();
  await expect(page.getByTestId("retry-count")).toHaveText("0");
  await expect(page.getByTestId("remove-count")).toHaveText("0");
  await expect(page.getByTestId("start-count")).toHaveText("0");
  expect(await form.evaluate((element) => ({
    entries: Array.from(new FormData(element as HTMLFormElement).entries()),
    valid: (element as HTMLFormElement).checkValidity(),
  }))).toEqual({ entries: [], valid: true });
});

test("FileUpload controls have no serious accessibility violations", async ({ page }) => {
  await page.goto("/tests/fixtures/m5-file-upload.html");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
