import { authFile, expect, test } from "./support";

test.use({ storageState: authFile("client") });

test.describe("клієнт", () => {
  test("створює проєкт, редагує його й додає завдання", async ({ page }) => {
    const title = `Клієнтський проєкт ${Date.now()}`;
    await page.goto("/projects/new");
    await page.locator("#project-title").fill(title);
    await page.locator("#project-description").fill("Перевірка створення проєкту.");
    await page.getByRole("button", { name: "Зберегти проєкт" }).click();
    // (?!new$): не плутати з /projects/new, звідки ще не пішли
    await expect(page).toHaveURL(/\/projects\/(?!new$)[\w-]+$/);
    const projectUrl = page.url();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    await page.goto(projectUrl + "/edit");
    await page.locator("#project-title").fill(title + " (змінено)");
    await page.getByRole("button", { name: "Зберегти проєкт" }).click();
    await expect(page.getByRole("heading", { name: title + " (змінено)" })).toBeVisible();

    await page.goto(projectUrl + "/tasks/new");
    await page.locator("#task-title").fill("Зробити макет головної сторінки");
    await page.locator("#task-description").fill("Перевірка створення завдання.");
    await page.getByRole("button", { name: "Зберегти завдання" }).click();
    await expect(page.getByText("Зробити макет головної сторінки").first()).toBeVisible();

    await page.goto(projectUrl + "/board");
    await expect(page.getByText("Зробити макет головної сторінки").first()).toBeVisible();
  });

  test("шукає завдання за назвою", async ({ page }) => {
    await page.goto("/tasks");
    await page.getByPlaceholder("Введіть частину назви").fill("неіснуюче-завдання-xyz");
    await page.getByRole("button", { name: "Знайти" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Завдання" })).toBeVisible();
    await expect(page.getByText("Не вдалося завантажити дані")).toHaveCount(0);
  });

  test("фільтрує сповіщення й позначає їх прочитаними", async ({ page }) => {
    await page.goto("/notifications");
    await page.getByRole("button", { name: /^Непрочитані/ }).click();
    const readAll = page.getByRole("button", { name: "Прочитати всі" });
    if (await readAll.isEnabled()) await readAll.click();
    await expect(page.getByText("Не вдалося завантажити дані")).toHaveCount(0);
  });

  test("відкриває профіль фрілансера з біржі людей", async ({ page }) => {
    await page.goto("/freelancers/d3e00000-0000-4000-8000-000000000003");
    await expect(page.getByRole("heading", { name: "Андрій Мельник" }).first()).toBeVisible();
  });
});
