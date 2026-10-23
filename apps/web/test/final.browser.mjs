import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function run(page) {
  const base = "http://127.0.0.1:5173";
  const run = Date.now();
  const password = `Final-${run}-Aa!`;
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const admin = JSON.parse(readFileSync(".tmp/final-admin.json", "utf8"));
  async function call(method, path, body, token, expected = 200) {
    const options = { data: body, headers: {} };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const response = await page.request[method](base + "/api" + path, options);
    assert(
      response.status() === expected,
      `${method} ${path} returned ${response.status()}, expected ${expected}`,
    );
    return response.json();
  }
  async function account(role, suffix) {
    const email = `final-${suffix}-${run}@example.com`;
    const name = `Фінальна перевірка ${suffix} ${run}`;
    const user = await call(
      "post",
      "/auth/register",
      { name, email, password, role },
      null,
      201,
    );
    const login = await call("post", "/auth/login", { email, password });
    return { ...user, password, token: login.accessToken };
  }
  async function signIn(user) {
    await page.goto(base + "/login");
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(base + "/login?fresh=" + Date.now());
    await page.getByLabel("Електронна пошта", { exact: true }).fill(user.email);
    await page.getByLabel("Пароль", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL(base + "/");
    await page.getByTestId("active-projects").waitFor();
  }
  async function openTask(id) {
    await page.goto(base + "/tasks/" + id);
    await page
      .getByRole("heading", { name: /Перевірити повний цикл/ })
      .waitFor();
  }
  async function upload(name, text) {
    await page
      .getByLabel("Файл для завантаження", { exact: true })
      .setInputFiles({
        name,
        mimeType: "text/plain",
        buffer: Buffer.from(text),
      });
    await page
      .getByRole("button", { name: "Завантажити файл", exact: true })
      .click();
    await page.getByRole("button", { name, exact: true }).waitFor();
  }
  const client = await account("CLIENT", "client");
  const freelancer = await account("FREELANCER", "freelancer");
  const outsider = await account("CLIENT", "outsider");
  const adminLogin = await call("post", "/auth/login", {
    email: admin.email,
    password: admin.password,
  });
  admin.token = adminLogin.accessToken;
  await signIn(client);
  await page.getByRole("link", { name: "Мої проєкти", exact: true }).click();
  await page
    .getByRole("link", { name: "Створити проєкт", exact: true })
    .click();
  const projectTitle = "Фінальний цикл " + run;
  await page.getByLabel("Назва проєкту", { exact: true }).fill(projectTitle);
  await page
    .getByLabel("Опис", { exact: true })
    .fill("Перевірка справжнього робочого циклу клієнта та фрилансера.");
  await page.getByLabel("Дедлайн", { exact: true }).fill("2027-12-20T15:30");
  await page
    .getByRole("button", { name: "Зберегти проєкт", exact: true })
    .click();
  await page
    .getByRole("heading", { name: projectTitle, exact: true })
    .waitFor();
  const projectId = page.url().split("/").pop();
  await page
    .getByRole("button", { name: "Додати учасника", exact: true })
    .click();
  await page
    .getByLabel("Фрилансер", { exact: true })
    .selectOption(freelancer.id);
  await page
    .getByRole("button", { name: "Додати до проєкту", exact: true })
    .click();
  await page.getByText(freelancer.name, { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Редагувати проєкт", exact: true })
    .click();
  await page.getByLabel("Статус", { exact: true }).selectOption("ACTIVE");
  await page
    .getByRole("button", { name: "Зберегти проєкт", exact: true })
    .click();
  await page
    .getByRole("heading", { name: projectTitle, exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Створити завдання", exact: true })
    .click();
  const taskTitle = "Перевірити повний цикл " + run;
  await page.getByLabel("Назва завдання", { exact: true }).fill(taskTitle);
  await page
    .getByLabel("Опис завдання", { exact: true })
    .fill("Підготувати результат і пройти перевірку клієнта.");
  await page
    .getByLabel("Виконавець", { exact: true })
    .selectOption(freelancer.id);
  await page.getByLabel("Пріоритет", { exact: true }).selectOption("HIGH");
  await page
    .getByLabel("Дедлайн завдання", { exact: true })
    .fill("2028-01-01T12:00");
  await page
    .getByRole("button", { name: "Зберегти завдання", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Дедлайн завдання не може бути пізнішим" })
    .waitFor();
  await page
    .getByLabel("Дедлайн завдання", { exact: true })
    .fill("2027-12-19T12:00");
  await page
    .getByRole("button", { name: "Зберегти завдання", exact: true })
    .click();
  await page.getByRole("heading", { name: taskTitle, exact: true }).waitFor();
  const taskId = page.url().split("/").pop();
  assert(
    (await page
      .getByRole("button", { name: "Почати виконання", exact: true })
      .count()) === 0,
    "Client cannot start freelancer task",
  );
  await page
    .getByRole("link", { name: "Редагувати завдання", exact: true })
    .click();
  await page
    .getByLabel("Опис завдання", { exact: true })
    .fill("Оновлений опис завдання.");
  await page
    .getByRole("button", { name: "Зберегти завдання", exact: true })
    .click();
  await page.getByText("Оновлений опис завдання.", { exact: true }).waitFor();

  await page.goto(base + `/messages?project=${projectId}`);
  await page
    .getByLabel("Нове повідомлення", { exact: true })
    .fill("Вітаю! Починаємо роботу.");
  await page
    .getByRole("button", { name: "Надіслати повідомлення", exact: true })
    .click();
  await page.getByText("Вітаю! Починаємо роботу.", { exact: true }).waitFor();
  await page.goto(base + `/projects/${projectId}/files`);
  await page
    .getByLabel("Файл для завантаження", { exact: true })
    .setInputFiles({
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("MZ-invalid-file"),
    });
  await page
    .getByRole("button", { name: "Завантажити файл", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Вміст файлу не відповідає його типу" })
    .waitFor();
  await upload("опис.txt", "Real client brief " + run);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "опис.txt", exact: true }).click();
  const downloaded = await downloadEvent;
  assert(
    downloaded.suggestedFilename() === "опис.txt",
    "Download keeps file name",
  );
  const stream = await downloaded.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert(
    Buffer.concat(chunks).toString() === "Real client brief " + run,
    "Download preserves actual content",
  );

  await page.goto(base + `/projects/${projectId}/orders`);
  await page
    .getByRole("button", { name: "Створити замовлення", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Розпочати замовлення", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Завершити замовлення", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Спочатку завершіть завдання" })
    .waitFor();
  await signIn(freelancer);
  await page.getByRole("link", { name: "Завдання", exact: true }).click();
  await page.getByLabel("Проєкт", { exact: true }).selectOption(projectId);
  await page.getByRole("link", { name: taskTitle, exact: true }).click();
  assert(
    (await page
      .getByRole("link", { name: "Редагувати завдання", exact: true })
      .count()) === 0,
    "Freelancer cannot edit owner fields",
  );
  await page
    .getByRole("button", { name: "Почати виконання", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Передати результат роботи", exact: true })
    .waitFor();
  await upload("result.txt", "First work result " + run);
  await page
    .getByLabel("Опис результату", { exact: true })
    .fill("Перший варіант результату.");
  await page
    .getByRole("button", { name: "Передати на перевірку", exact: true })
    .click();
  await page.getByText("Очікує перевірки", { exact: true }).waitFor();
  const firstSubmissions = await call(
    "get",
    `/tasks/${taskId}/submissions`,
    undefined,
    freelancer.token,
  );
  assert(
    firstSubmissions[0].files.length === 1,
    "Uploaded result file is attached to submission",
  );
  await call(
    "post",
    `/submissions/${firstSubmissions[0].id}/review`,
    { decision: "APPROVE", feedback: "Forbidden" },
    freelancer.token,
    403,
  );
  await page.goto(base + `/messages?project=${projectId}`);
  await page.getByText("Вітаю! Починаємо роботу.", { exact: true }).waitFor();
  await page
    .getByLabel("Нове повідомлення", { exact: true })
    .fill("Результат передано на перевірку.");
  await page
    .getByRole("button", { name: "Надіслати повідомлення", exact: true })
    .click();
  await page
    .getByText("Результат передано на перевірку.", { exact: true })
    .waitFor();

  await signIn(client);
  await openTask(taskId);
  await page
    .getByLabel("Рішення", { exact: true })
    .selectOption("NEEDS_REVISION");
  await page
    .getByLabel("Відгук", { exact: true })
    .fill("Додайте пояснення до результату.");
  await page
    .getByRole("button", { name: "Зберегти рішення", exact: true })
    .click();
  await page.getByText("Повернуто на доопрацювання", { exact: true }).waitFor();
  await signIn(freelancer);
  await openTask(taskId);
  await page
    .getByText("Додайте пояснення до результату.", { exact: true })
    .waitFor();
  await page
    .getByLabel("Опис результату", { exact: true })
    .fill("Оновлений результат із поясненням.");
  await page
    .getByRole("button", { name: "Передати на перевірку", exact: true })
    .click();
  await page.getByText("Очікує перевірки", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Task details fit mobile",
  );
  await page.screenshot({ path: ".tmp/final-task-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(client);
  await openTask(taskId);
  await page
    .getByLabel("Відгук", { exact: true })
    .fill("Роботу прийнято. Дякую!");
  await page
    .getByRole("button", { name: "Зберегти рішення", exact: true })
    .click();
  await page.getByText("Прийнято", { exact: true }).waitFor();
  assert(
    (await call("get", `/tasks/${taskId}`, undefined, client.token)).status ===
      "DONE",
    "Approval completes task",
  );
  await page.screenshot({
    path: ".tmp/final-task-desktop.png",
    fullPage: true,
  });
  await page.goto(base + `/projects/${projectId}/orders`);
  await page
    .getByRole("button", { name: "Завершити замовлення", exact: true })
    .click();
  await page.getByText("Виконано", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Створити замовлення", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Скасувати замовлення", exact: true })
    .click();
  await page.getByText("Скасовано", { exact: true }).waitFor();
  await page.goto(base + `/projects/${projectId}`);
  await page
    .getByRole("link", { name: "Редагувати проєкт", exact: true })
    .click();
  await page.getByLabel("Статус", { exact: true }).selectOption("COMPLETED");
  await page
    .getByRole("button", { name: "Зберегти проєкт", exact: true })
    .click();
  await page
    .getByRole("heading", { name: projectTitle, exact: true })
    .waitFor();
  const completed = await call(
    "get",
    `/projects/${projectId}`,
    undefined,
    client.token,
  );
  assert(
    completed.status === "COMPLETED" && completed.progress === 100,
    "Project finishes with actual 100% progress",
  );

  await signIn(outsider);
  await page.goto(base + `/tasks/${taskId}`);
  await page.getByRole("alert").filter({ hasText: "Немає доступу" }).waitFor();
  await call(
    "get",
    `/projects/${projectId}/messages`,
    undefined,
    outsider.token,
    403,
  );
  await call(
    "get",
    `/projects/${projectId}/orders`,
    undefined,
    outsider.token,
    403,
  );
  await call(
    "get",
    `/files/${firstSubmissions[0].files[0].id}/download`,
    undefined,
    outsider.token,
    403,
  );
  await page.goto(base + "/admin");
  await page
    .getByRole("heading", { name: "Доступ заборонено", exact: true })
    .waitFor();
  await call("get", "/admin/users", undefined, outsider.token, 403);

  await signIn(admin);
  await page
    .getByRole("link", { name: "Адміністрування", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Адміністративна панель", exact: true })
    .waitFor();
  const outsiderCard = page
    .locator(".user-card")
    .filter({ hasText: outsider.email });
  await outsiderCard
    .getByLabel("Стан користувача", { exact: true })
    .selectOption("BLOCKED");
  await outsiderCard
    .getByRole("button", { name: "Зберегти користувача", exact: true })
    .click();
  await outsiderCard
    .locator(".project-status")
    .filter({ hasText: "Заблокований" })
    .waitFor();
  await call("get", "/auth/me", undefined, outsider.token, 403);
  await outsiderCard
    .getByLabel("Стан користувача", { exact: true })
    .selectOption("ACTIVE");
  await outsiderCard
    .getByLabel("Роль користувача", { exact: true })
    .selectOption("FREELANCER");
  await outsiderCard
    .getByRole("button", { name: "Зберегти користувача", exact: true })
    .click();
  await outsiderCard
    .locator(".project-status")
    .filter({ hasText: "Активний" })
    .waitFor();
  const freelancerCard = page
    .locator(".user-card")
    .filter({ hasText: freelancer.email });
  await freelancerCard
    .getByLabel("Роль користувача", { exact: true })
    .selectOption("CLIENT");
  await freelancerCard
    .getByRole("button", { name: "Зберегти користувача", exact: true })
    .click();
  await freelancerCard
    .getByRole("alert")
    .filter({ hasText: "Не можна змінити роль" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Admin page fits mobile",
  );
  await page.screenshot({
    path: ".tmp/final-admin-mobile.png",
    fullPage: false,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  assert(errors.length === 0, "Unexpected page errors: " + errors.join(", "));
  writeFileSync(
    ".tmp/final-run.json",
    JSON.stringify({
      projectId,
      taskId,
      client: { email: client.email, password },
      freelancer: { email: freelancer.email, password },
    }),
  );
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(base + "/login");
}

const modulePath =
  process.env.PLAYWRIGHT_MODULE ||
  join(
    process.env.APPDATA || "",
    "npm/node_modules/@playwright/cli/node_modules/playwright/index.mjs",
  );
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
try {
  await run(page);
  console.log(
    "Final browser flow passed: client, freelancer, admin, files, orders, messages, submissions, revision, approval and access isolation.",
  );
} catch (error) {
  await page.screenshot({ path: ".tmp/final-failure.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
