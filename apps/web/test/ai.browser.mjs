import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const fixture = JSON.parse(readFileSync(".tmp/final-run.json", "utf8"));
const modulePath =
  process.env.PLAYWRIGHT_MODULE ||
  join(
    process.env.APPDATA || "",
    "npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs",
  );
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20000);
const base = "http://127.0.0.1:5173";
try {
  await page.goto(base + "/login");
  await page
    .getByLabel("Електронна пошта", { exact: true })
    .fill(fixture.client.email);
  await page
    .getByLabel("Пароль", { exact: true })
    .fill(fixture.client.password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(base + "/");
  await page.getByTestId("active-projects").waitFor();
  await page.goto(base + "/ai?project=" + fixture.projectId);
  await page
    .getByLabel("Запитання до Ади", { exact: true })
    .fill(
      "Використай get_project_summary для цього проєкту. Напиши його точну назву, статус і відсоток виконання.",
    );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/agent/chat") &&
      response.request().method() === "POST",
    { timeout: 140000 },
  );
  await page
    .getByRole("button", { name: "Надіслати запит", exact: true })
    .click();
  const response = await responsePromise;
  const result = await response.json();
  if (response.status() !== 200)
    throw new Error(`Live AI returned ${response.status()}: ${result.message}`);
  if (!result.toolsUsed.includes("get_project_summary"))
    throw new Error("Live AI did not use the requested project summary tool.");
  if (!/100\s*%/.test(result.answer))
    throw new Error(
      "Live AI answer did not contain actual 100% project progress.",
    );
  await page.locator(".ai-answer").waitFor();
  await page.screenshot({ path: ".tmp/final-ai-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    !(await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ))
  )
    throw new Error("AI page overflows mobile viewport.");
  await page.screenshot({ path: ".tmp/final-ai-mobile.png", fullPage: true });
  writeFileSync(
    ".tmp/ai-result.json",
    JSON.stringify({
      status: response.status(),
      toolsUsed: result.toolsUsed,
      answer: result.answer,
    }),
  );
  console.log(
    "Live browser AI check passed: UI -> JWT API -> provider -> MCP get_project_summary -> PostgreSQL -> actual 100% progress.",
  );
} catch (error) {
  await page.screenshot({ path: ".tmp/final-ai-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
