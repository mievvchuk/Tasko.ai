import { authFile, accounts, expect, test } from "./support";

test.use({ storageState: authFile("admin") });

test.describe("адміністратор", () => {
  test("знаходить користувача за email", async ({ page }) => {
    await page.goto("/admin/users");
    const search = page.getByPlaceholder("Ім'я або email");
    await search.fill(accounts.client.email);
    await search.press("Enter");
    await expect(page.getByText(accounts.client.name).first()).toBeVisible();
    await expect(page.getByText(accounts.freelancer.name)).toHaveCount(0);
  });

  test("завантажує звіт у CSV і JSON", async ({ page }) => {
    await page.goto("/admin");
    for (const format of ["CSV", "JSON"]) {
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: format, exact: true }).click();
      expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${format}$`, "i"));
    }
  });

  test("відхиляє проєкт на модерації з причиною", async ({ page, browser }) => {
    const title = `На відхилення ${Date.now()}`;
    const client = await browser.newContext({ storageState: authFile("client") });
    const clientPage = await client.newPage();
    await clientPage.goto("/projects/new");
    await clientPage.locator("#project-title").fill(title);
    await clientPage.getByRole("button", { name: "Зберегти проєкт" }).click();
    await expect(clientPage).toHaveURL(/\/projects\/(?!new$)[\w-]+$/);
    await client.close();

    await page.goto("/admin/moderation");
    const card = page.locator(".moderation-card").filter({ hasText: title });
    await card.getByRole("button", { name: "Відхилити", exact: true }).click();
    await card.getByPlaceholder("Що саме виправити, щоб проєкт пройшов модерацію").fill(
      "Додайте опис і бюджет проєкту.",
    );
    await card.getByRole("button", { name: "Відхилити проєкт" }).click();
    await expect(card).toHaveCount(0);
  });

  test("фільтрує проєкти й скарги", async ({ page }) => {
    await page.goto("/admin/projects");
    await page.getByPlaceholder("Назва проєкту").fill("неіснуючий-проєкт-xyz");
    await page.getByPlaceholder("Назва проєкту").press("Enter");
    await expect(page.getByText("Проєктів не знайдено.")).toBeVisible();

    await page.goto("/admin/complaints");
    await page.getByPlaceholder("Причина, автор або ціль").fill("неіснуюча-скарга-xyz");
    await page.getByPlaceholder("Причина, автор або ціль").press("Enter");
    await expect(page.getByText("Скарг не знайдено.")).toBeVisible();
  });
});
