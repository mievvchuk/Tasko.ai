import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import(
  pathToFileURL(
    process.env.PLAYWRIGHT_MODULE ||
      path.join(
        process.env.APPDATA || "",
        "npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs",
      ),
  ).href
);
const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:5173";
const output = path.resolve(".tmp/planning-browser");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
const errors = [];
const guest = await browser.newContext({
  viewport: { width: 1365, height: 900 },
  colorScheme: "light",
});
let context;
try {
  const page = await guest.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/login`);
  const theme = page.getByRole("combobox", { name: "Тема сайту" });
  await theme.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.match(
    await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).fontFamily),
    /Manrope/,
  );
  assert.equal(
    await page.evaluate(() =>
      document.fonts.check("16px Manrope", "Українська Єє Іі Її Ґґ"),
    ),
    true,
  );
  await theme.selectOption("dark");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.screenshot({ path: path.join(output, "login-dark.png") });
  await page.reload();
  await theme.waitFor();
  assert.equal(await theme.inputValue(), "dark");
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await theme.selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await theme.selectOption("dark");
  await page.emulateMedia({ colorScheme: "light" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  const secondTab = await guest.newPage();
  await secondTab.goto(`${base}/login`);
  await secondTab.getByRole("combobox", { name: "Тема сайту" }).waitFor();
  await theme.selectOption("light");
  await secondTab.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await secondTab.close();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Guest overflow at ${width}px`,
    );
  }
  await page.screenshot({
    path: path.join(output, "login-light-mobile.png"),
    fullPage: true,
  });

  const projectId = "1dc56f4b-3f25-41ca-8e73-9753028a93de";
  let role = "CLIENT";
  let configured = true;
  const submissions = [];
  const draft = {
    milestones: [
      {
        title: "Прототип",
        description: "Погодити структуру майбутнього сайту",
        acceptanceCriteria: ["Структуру погоджено із замовником"],
        tasks: [
          {
            title: "Дослідити вимоги",
            description: "Зібрати побажання та підготувати перелік сторінок",
            priority: "HIGH",
            acceptanceCriteria: ["Вимоги описано"],
          },
        ],
      },
    ],
  };
  context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("tasko.accessToken", "browser-test-only"),
  );
  await context.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace(/^\/api/, "");
    let body;
    let status = 200;
    if (endpoint === "/auth/me")
      body = {
        id: "client-id",
        name: "Тестовий користувач",
        email: "test@example.com",
        role,
        status: "ACTIVE",
      };
    else if (endpoint === "/notifications")
      body = { items: [], unreadCount: 0 };
    else if (endpoint === "/agent/status")
      body = { configured, toolsReadOnly: true };
    else if (endpoint === `/projects/${projectId}`)
      body = {
        id: projectId,
        clientId: "client-id",
        title: "Портфоліо дизайнера",
        description: "Адаптивний сайт із прикладами робіт",
        status: "ACTIVE",
      };
    else if (endpoint.endsWith("/ai-plan/apply")) {
      submissions.push(route.request().postDataJSON());
      if (submissions.length === 1) {
        status = 500;
        body = { message: "Тимчасова помилка збереження" };
      } else body = { applied: true, alreadyApplied: true };
    } else if (endpoint.endsWith("/ai-plan")) body = draft;
    else {
      status = 404;
      body = { message: `Unexpected browser fixture endpoint: ${endpoint}` };
    }
    await route.fulfill({ status, json: body });
  });
  const work = await context.newPage();
  work.on("pageerror", (error) => errors.push(error.message));
  await work.goto(`${base}/projects/${projectId}/plan`);
  await work.getByRole("button", { name: "Запропонувати план" }).click();
  await work
    .getByLabel("Назва етапу", { exact: true })
    .fill("Дизайн і прототип");
  await work
    .getByLabel("Назва завдання", { exact: true })
    .fill("Уточнити вимоги");
  await work
    .getByRole("button", { name: "Додати завдання", exact: true })
    .click();
  assert.equal(
    await work.getByLabel("Назва завдання", { exact: true }).count(),
    2,
  );
  await work
    .getByRole("button", { name: "Прибрати завдання", exact: true })
    .last()
    .click();
  await work.getByRole("combobox", { name: "Тема сайту" }).selectOption("dark");
  await work.screenshot({
    path: path.join(output, "plan-dark-desktop.png"),
    fullPage: true,
  });
  await work.setViewportSize({ width: 390, height: 844 });
  await work.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await work.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 1,
  );
  assert.ok(
    await work.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Editor overflow at 390px",
  );
  await work.screenshot({
    path: path.join(output, "plan-dark-mobile.png"),
    fullPage: true,
  });
  await work
    .getByRole("button", { name: "Підтвердити й додати до проєкту" })
    .click();
  await work
    .getByRole("alert")
    .filter({ hasText: "Тимчасова помилка" })
    .waitFor();
  assert.equal(
    await work.getByLabel("Назва етапу", { exact: true }).isDisabled(),
    true,
  );
  await work.getByRole("button", { name: "Повторити підтвердження" }).click();
  await work.getByRole("heading", { name: "План додано до проєкту" }).waitFor();
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].requestId, submissions[1].requestId);
  assert.equal(submissions[1].plan.milestones[0].title, "Дизайн і прототип");
  assert.equal(
    submissions[1].plan.milestones[0].tasks[0].title,
    "Уточнити вимоги",
  );
  configured = false;
  await work.reload();
  await work
    .getByText("AI-провайдер ще не підключений.", { exact: false })
    .waitFor();
  assert.equal(
    await work.getByRole("button", { name: "Запропонувати план" }).isDisabled(),
    true,
  );
  // An authenticated freelancer with access cannot see the owner-only editor.
  role = "FREELANCER";
  await work.reload();
  // Use a different identity to exercise the client ownership condition too.
  await context.unroute("**/api/**");
  await context.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    let body = { items: [], unreadCount: 0 };
    if (endpoint.endsWith("/auth/me"))
      body = { id: "freelancer-id", name: "Фрилансер", role: "FREELANCER" };
    else if (endpoint.endsWith("/agent/status")) body = { configured: true };
    else if (endpoint.endsWith(`/projects/${projectId}`))
      body = {
        id: projectId,
        clientId: "client-id",
        title: "Портфоліо",
        status: "ACTIVE",
      };
    await route.fulfill({ json: body });
  });
  await work.reload();
  await work
    .getByRole("alert")
    .filter({ hasText: "Планування доступне власнику" })
    .waitFor();
  assert.equal(
    await work.getByRole("button", { name: "Запропонувати план" }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser passed: local Manrope, light/dark/system, persistence, OS changes, cross-tab sync, 320/390px, editable AI draft, safe retry, unavailable provider and owner-only UI. Screenshots:",
    output,
  );
} finally {
  await context?.close();
  await guest.close();
  await browser.close();
}
