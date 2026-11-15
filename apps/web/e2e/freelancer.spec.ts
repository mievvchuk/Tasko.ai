import { authFile, expect, test } from "./support";

test.use({ storageState: authFile("freelancer") });

test.describe("фрилансер", () => {
  test("шукає проєкти на біржі та скидає фільтри", async ({ page }) => {
    await page.goto("/marketplace");
    await page.getByPlaceholder("Назва або опис").fill("неіснуючий-проєкт-xyz");
    await expect(page.getByText("За цими фільтрами проєктів немає")).toBeVisible();
    await page.getByRole("button", { name: "Скинути" }).click();
    await expect(page.getByText("За цими фільтрами проєктів немає")).toHaveCount(0);
  });

  test("додає проєкт в обране й прибирає його", async ({ page }) => {
    await page.goto("/marketplace");
    await page.getByRole("button", { name: "Додати в обране" }).first().click();
    await page.getByText("Лише обране").click();
    const remove = page.getByRole("button", { name: "Видалити з обраного" }).first();
    await expect(remove).toBeVisible();
    await remove.click();
  });

  test("редагує профіль фрілансера", async ({ page }) => {
    const bio = `Full-stack розробник. Оновлено ${Date.now()}`;
    await page.goto("/profile");
    await page.getByRole("button", { name: "Редагувати профіль фрілансера" }).click();
    await page.getByLabel("Про себе").fill(bio);
    await page.getByRole("button", { name: "Зберегти профіль" }).click();
    await expect(page.getByText("Профіль збережено.")).toBeVisible();
  });

  test("бачить свої завдання та відкриває одне з них", async ({ page }) => {
    await page.goto("/tasks");
    const firstTask = page.locator("table a[href^='/tasks/'], .task-card a[href^='/tasks/']").first();
    await firstTask.click();
    await expect(page).toHaveURL(/\/tasks\/[\w-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
