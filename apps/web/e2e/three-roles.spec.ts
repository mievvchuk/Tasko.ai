import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Пароль демо-акаунтів створює `npm run seed:demo` в apps/api
const { password } = JSON.parse(readFileSync(new URL("../../../.tmp/demo-accounts.json", import.meta.url), "utf8")) as {
  password: string;
};

const accounts = {
  client: "olena.koval@tasko.ai",
  freelancer: "andrii.melnyk@tasko.ai",
  admin: "admin@tasko.ai",
};

// Кожна роль — окремий контекст браузера зі своєю сесією
async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Електронна пошта", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

test("клієнт, адмін і фрилансер проходять шлях проєкту від створення до заявки", async ({ browser }) => {
  const title = `E2E проєкт ${Date.now()}`;
  const client = await signIn(browser, accounts.client);
  const admin = await signIn(browser, accounts.admin);
  const freelancer = await signIn(browser, accounts.freelancer);

  await test.step("клієнт створює проєкт", async () => {
    await client.goto("/projects/new");
    await client.locator("#project-title").fill(title);
    await client.locator("#project-description").fill("Створено автотестом Playwright.");
    await client.getByLabel("Бюджет від, грн").fill("5000");
    await client.getByLabel("Бюджет до, грн").fill("10000");
    await client.getByRole("button", { name: "Зберегти проєкт" }).click();
    await expect(client).toHaveURL(/\/projects\/(?!new$)[\w-]+$/);
  });

  await test.step("адмін схвалює проєкт на модерації", async () => {
    await admin.goto("/admin/moderation");
    const card = admin.locator(".moderation-card").filter({ hasText: title });
    await card.getByRole("button", { name: "Схвалити й опублікувати" }).click();
    await expect(card).toHaveCount(0);
  });

  await test.step("фрилансер знаходить проєкт на біржі й подає заявку", async () => {
    await freelancer.goto("/marketplace");
    await freelancer.getByRole("link", { name: title }).first().click();
    await freelancer.getByLabel("Супровідне повідомлення").fill("Маю досвід у схожих проєктах, готовий почати одразу.");
    await freelancer.getByLabel("Бюджет, грн").fill("8000");
    await freelancer.getByLabel("Строк, днів").fill("14");
    await freelancer.getByRole("button", { name: "Надіслати заявку" }).click();
    await expect(freelancer.getByRole("heading", { name: "Ваша заявка" })).toBeVisible();
  });

  await test.step("клієнт бачить заявку фрилансера", async () => {
    await client.goto(client.url() + "/applications");
    await expect(client.getByText("Андрій Мельник").first()).toBeVisible();
  });

  await test.step("фрилансер не має доступу до адмін-панелі", async () => {
    await freelancer.goto("/admin");
    await expect(freelancer.getByRole("heading", { name: "Доступ заборонено" })).toBeVisible();
  });
});
