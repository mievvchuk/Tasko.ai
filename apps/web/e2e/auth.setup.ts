import { test as setup, expect } from "@playwright/test";
import { accounts, authFile, password, type Role } from "./support";

// Входимо за кожну роль і зберігаємо сесію («Запам'ятати мене» кладе токен у localStorage).
// Один тест із усіма ролями в назві, щоб фільтр -g за будь-якою роллю його не пропустив.
setup("вхід за всі ролі (client, freelancer, admin)", async ({ browser }) => {
  for (const role of Object.keys(accounts) as Role[]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Електронна пошта", { exact: true }).fill(accounts[role].email);
    await page.getByLabel("Пароль", { exact: true }).fill(password);
    await page.getByLabel("Запам'ятати мене").check();
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await context.storageState({ path: authFile(role) });
    await context.close();
  }
});
