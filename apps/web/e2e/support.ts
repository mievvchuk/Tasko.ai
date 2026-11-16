import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test as base, type Page } from "@playwright/test";

// Пароль демо-акаунтів створює `npm run seed:demo` в apps/api
export const password = (
  JSON.parse(readFileSync(new URL("../../../.tmp/demo-accounts.json", import.meta.url), "utf8")) as { password: string }
).password;

export const accounts = {
  client: { email: "olena.koval@tasko.ai", name: "Олена Коваль" },
  freelancer: { email: "andrii.melnyk@tasko.ai", name: "Андрій Мельник" },
  admin: { email: "admin@tasko.ai", name: "Адміністратор" },
} as const;

export type Role = keyof typeof accounts;

export const authFile = (role: Role) => fileURLToPath(new URL(`../.auth/${role}.json`, import.meta.url));

// Токен із збереженої сесії — для запитів до API (отримати id проєктів, задач тощо)
function tokenOf(role: Role): string {
  const state = JSON.parse(readFileSync(authFile(role), "utf8")) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  const item = state.origins.flatMap((origin) => origin.localStorage).find((entry) => entry.name === "tasko.accessToken");
  if (!item) throw new Error(`Немає збереженого входу для ролі ${role}`);
  return item.value;
}

export async function apiGet<T>(page: Page, role: Role, path: string): Promise<T> {
  const response = await page.request.get(`http://localhost:3000${path}`, {
    headers: { Authorization: `Bearer ${tokenOf(role)}` },
  });
  expect(response.ok(), `GET ${path} → ${response.status()}`).toBeTruthy();
  return (await response.json()) as T;
}

// Кожен тест автоматично падає, якщо на сторінці сталася JS-помилка
export const test = base.extend<{ jsErrors: string[] }>({
  jsErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      const failedRequests: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().includes("/api/") && response.status() >= 400)
          failedRequests.push(`${response.status()} ${response.request().method()} ${response.url()}`);
      });
      await use(errors);
      // У звіті про падіння видно, який запит до API повернув помилку
      if (failedRequests.length) await testInfo.attach("невдалі запити до API", { body: failedRequests.join("\n") });
      expect(errors, "JS-помилки на сторінці").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// Сторінка відкрилась нормально: є заголовок, немає 404, заборони й помилки завантаження
export async function expectPageOpens(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByText("Завантажуємо дані…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Сторінку не знайдено" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Доступ заборонено" })).toHaveCount(0);
  await expect(page.getByText("Не вдалося завантажити дані")).toHaveCount(0);
}
