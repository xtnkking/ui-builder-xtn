// Runs against an installed production starter, not the component Explorer.
import { expect, test } from "@playwright/test";

test("installed production starter exposes product branding without library promotion", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page).toHaveTitle("应用");
  await expect(page.getByRole("heading", { name: "应用", exact: true })).toBeVisible();
  await expect(page.locator("[data-ui-owner='PageHeading']")).toBeVisible();
  expect(await page.content()).not.toMatch(/ui-builder-xtn|xtnkking|personal[ -]ui/i);
  expect(requests.some((url) => /\/assets\/.*\.js(?:\?|$)/.test(url))).toBe(true);
  expect(requests.some((url) => /\/assets\/.*\.css(?:\?|$)/.test(url))).toBe(true);
  for (const url of requests) {
    expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    expect(url).not.toMatch(/ui-builder-xtn|xtnkking|\.map(?:\?|$)/i);
  }
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("neutral-consumer-320.png"), fullPage: true });
});
