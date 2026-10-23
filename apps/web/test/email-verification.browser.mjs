import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import(
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || "msedge",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let verifications = 0;
let resends = 0;
await context.route("**/api/**", async (route) => {
  const endpoint = new URL(route.request().url()).pathname;
  if (endpoint.endsWith("/auth/verify-email")) {
    verifications++;
    assert.equal(route.request().postDataJSON().token, "x".repeat(43));
    await route.fulfill({
      json: { message: "Пошту підтверджено. Тепер можна увійти до Tasko.ai." },
    });
  } else if (endpoint.endsWith("/auth/resend-verification")) {
    resends++;
    await route.fulfill({
      json: {
        message: "Якщо ця пошта очікує підтвердження, на неї надіслано лист.",
      },
    });
  } else
    await route.fulfill({ status: 401, json: { message: "Not signed in" } });
});
try {
  const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:5173";
  await page.goto(`${base}/verify-email?token=${"x".repeat(43)}`);
  await page.getByRole("heading", { name: "Підтвердження пошти" }).waitFor();
  await page.waitForFunction(() => !location.search);
  assert.equal(
    verifications,
    0,
    "Email scanners and page loading must not consume the token",
  );
  await page
    .getByRole("button", { name: "Підтвердити пошту", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Пошту підтверджено" })
    .waitFor();
  assert.equal(verifications, 1);
  await page.goto(`${base}/verify-email`);
  await page
    .getByRole("textbox", { name: "Електронна пошта" })
    .fill("user@example.com");
  await page.getByRole("button", { name: "Надіслати лист повторно" }).click();
  await page.getByRole("button", { name: /Повторити через/ }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Повторити через/ }).isDisabled(),
    true,
  );
  assert.equal(resends, 1);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}px`,
    );
  }
  await mkdir(".tmp/email-verification-browser", { recursive: true });
  await page.getByRole("combobox", { name: "Тема сайту" }).selectOption("dark");
  await page.screenshot({
    path: path.resolve(".tmp/email-verification-browser/verify-dark.png"),
  });
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: public confirmation, URL token removal, explicit confirmation, resend cooldown, themes and 320/390/1280px layouts.",
  );
} finally {
  await context.close();
  await browser.close();
}
