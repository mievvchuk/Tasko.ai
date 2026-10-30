async (page) => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const baseUrl = 'http://127.0.0.1:5173';
  const email = `ui-check-${Date.now()}@example.com`;
  const name = 'Перевірка інтерфейсу';
  const password = `Ui-check-${Date.now()}-Aa!`;
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto(baseUrl);
  await page.waitForURL('**/login');
  await page.getByRole('heading', { name: 'Увійдіть до Tasko.ai' }).waitFor();

  await page.getByRole('link', { name: 'Зареєструватися', exact: true }).click();
  await page.getByLabel('Ім’я', { exact: true }).fill(name);
  await page.getByLabel('Електронна пошта', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повторіть пароль', { exact: true }).fill(password + 'wrong');
  await page.getByRole('button', { name: 'Створити обліковий запис' }).click();
  await page.getByRole('alert').filter({ hasText: 'Паролі не збігаються.' }).waitFor();
  await page.getByRole('radio', { name: /Фрилансер/ }).check();
  assert(await page.getByRole('radio', { name: /Фрилансер/ }).isChecked(), 'Role selector should work');
  await page.getByRole('radio', { name: /Клієнт/ }).check();
  await page.getByLabel('Повторіть пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Створити обліковий запис' }).click();
  await page.waitForURL('**/login');
  await page.getByRole('status').filter({ hasText: 'Обліковий запис створено.' }).waitFor();

  await page.getByLabel('Пароль', { exact: true }).fill(password + 'wrong');
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Неправильна пошта або пароль.' }).waitFor();
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Показати пароль' }).click();
  assert(await page.getByLabel('Пароль', { exact: true }).getAttribute('type') === 'text', 'Password visibility should work');
  await page.getByRole('button', { name: 'Приховати пароль' }).click();
  await page.getByRole('button', { name: 'Увійти', exact: true }).click();
  await page.waitForURL(baseUrl + '/');
  await page.getByRole('heading', { name: 'Головна панель' }).waitFor();
  await page.getByRole('link', { name: 'Профіль', exact: true }).click();
  await page.getByText(email, { exact: true }).waitFor();
  assert(await page.evaluate(() => Boolean(sessionStorage.getItem('tasko.accessToken'))), 'JWT should be stored');
  await page.getByRole('link', { name: 'Головна', exact: true }).click();
  await page.screenshot({ path: '.tmp/tasko-workspace.png', fullPage: true });

  await page.reload();
  await page.getByRole('heading', { name: 'Головна панель' }).waitFor();
  await page.goto(baseUrl + '/login');
  await page.waitForURL(baseUrl + '/');

  await page.route('**/api/auth/me', (route) => route.abort());
  await page.reload();
  await page.getByRole('heading', { name: 'Не вдалося відновити сеанс' }).waitFor();
  assert(await page.evaluate(() => Boolean(sessionStorage.getItem('tasko.accessToken'))), 'Network errors should preserve the JWT');
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Спробувати ще раз' }).click();
  await page.getByRole('heading', { name: 'Головна панель' }).waitFor();

  await page.goto(baseUrl + '/unknown-page');
  await page.getByRole('heading', { name: 'Сторінку не знайдено' }).waitFor();
  await page.getByRole('link', { name: 'На головну', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout should not overflow');
  await page.getByRole('button', { name: 'Відкрити навігацію' }).click();
  // Вихід тепер у меню облікового запису: спершу відкриваємо меню
  await page.getByRole('button', { name: 'Меню облікового запису' }).click();
  await page.getByRole('button', { name: 'Вийти з облікового запису' }).click();
  await page.waitForURL('**/login');
  assert(await page.evaluate(() => sessionStorage.getItem('tasko.accessToken')) === null, 'Logout should remove the token');

  await page.evaluate(() => sessionStorage.setItem('tasko.accessToken', 'invalid-test-token'));
  await page.goto(baseUrl);
  await page.waitForURL('**/login');
  await page.getByRole('status').filter({ hasText: 'Сеанс завершено' }).waitFor();
  assert(await page.evaluate(() => sessionStorage.getItem('tasko.accessToken')) === null, 'Invalid token should be cleared');

  await page.getByRole('link', { name: 'Зареєструватися', exact: true }).click();
  await page.getByLabel('Ім’я', { exact: true }).fill(name);
  await page.getByLabel('Електронна пошта', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повторіть пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Створити обліковий запис' }).click();
  await page.getByRole('alert').filter({ hasText: 'Ця електронна пошта вже зареєстрована.' }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile registration should not overflow');
  await page.screenshot({ path: '.tmp/tasko-register-mobile.png', fullPage: true });
  assert(browserErrors.length === 0, 'No unexpected browser errors: ' + browserErrors.join(', '));
  console.log('Browser checks passed: registration, roles, validation, login, reload, retry, JWT, logout, mobile layout, duplicate account.');
  console.log('One isolated UI test account was created and preserved; existing records were not deleted.');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(baseUrl + '/login');
}
