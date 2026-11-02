async (page) => {
  const baseUrl = 'http://127.0.0.1:5173';
  const run = Date.now();
  const password = `Dashboard-${run}-Aa!`;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseUrl + '/login');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();

  async function call(method, path, body, token, expected = 200) {
    const options = { data: body, headers: {} };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const response = await page.request[method](baseUrl + '/api' + path, options);
    assert(response.status() === expected, `${method} ${path} returned ${response.status()}`);
    return response.json();
  }
  async function account(role) {
    const email = `dashboard-${role.toLowerCase()}-${run}@example.com`;
    const user = await call('post', '/auth/register', { name: 'Перевірка головної', email, password, role }, null, 201);
    const login = await call('post', '/auth/login', { email, password });
    return { ...user, token: login.accessToken };
  }
  async function signIn(user) {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(baseUrl + '/login');
    await page.getByLabel('Електронна пошта', { exact: true }).fill(user.email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await page.waitForURL(baseUrl + '/');
    await page.getByTestId('active-projects').waitFor();
  }

  const client = await account('CLIENT');
  const freelancer = await account('FREELANCER');
  await signIn(freelancer);
  assert(await page.getByTestId('total-tasks').textContent() === '0', 'Empty dashboard should show actual zero');
  await page.getByRole('link', { name: 'Мої проєкти', exact: true }).click();
  await page.getByRole('heading', { name: 'Проєктів не знайдено' }).waitFor();

  const deadline = new Date(Date.now() + 5 * 86400000).toISOString();
  const first = await call('post', '/projects', { title: `Доступний проєкт ${run}`, description: 'Перевірка реальних даних', deadline }, client.token, 201);
  const second = await call('post', '/projects', { title: `Приватний проєкт ${run}` }, client.token, 201);
  await call('post', `/projects/${first.id}/members`, { userId: freelancer.id }, client.token, 201);
  await call('patch', `/projects/${first.id}`, { status: 'ACTIVE' }, client.token);
  const task = await call('post', `/projects/${first.id}/tasks`, { title: 'Завдання для перевірки', assigneeId: freelancer.id, deadline }, client.token, 201);
  await call('patch', `/tasks/${task.id}/status`, { status: 'IN_PROGRESS' }, freelancer.token);

  await signIn(client);
  assert(await page.getByTestId('active-projects').textContent() === '1', 'Active project count');
  assert(await page.getByTestId('total-tasks').textContent() === '1', 'Task count');
  assert(await page.getByTestId('in-progress-tasks').textContent() === '1', 'In-progress count');
  await page.getByText(first.title, { exact: true }).waitFor();
  assert(await page.getByText(second.title, { exact: true }).count() === 0, 'Dashboard should list only active projects');
  await page.screenshot({ path: '.tmp/tasko-dashboard.png', fullPage: true });

  await page.getByRole('link', { name: /Усі проєкти/ }).click();
  await page.getByText(first.title, { exact: true }).waitFor();
  await page.getByText(second.title, { exact: true }).waitFor();
  await page.getByLabel('Статус проєкту').selectOption('PLANNING');
  await page.getByText(second.title, { exact: true }).waitFor();
  assert(await page.getByText(first.title, { exact: true }).count() === 0, 'Status filter should use API');
  assert(page.url().includes('status=PLANNING'), 'Filter should be reflected in URL');
  await page.reload();
  await page.getByText(second.title, { exact: true }).waitFor();
  assert(await page.getByLabel('Статус проєкту').inputValue() === 'PLANNING', 'Filter survives reload');
  await page.getByLabel('Статус проєкту').selectOption('COMPLETED');
  await page.getByRole('heading', { name: 'Проєктів не знайдено' }).waitFor();
  await page.getByRole('button', { name: 'Скинути фільтр' }).click();
  await page.getByText(first.title, { exact: true }).waitFor();
  assert(await page.getByRole('button', { name: /Наступна/ }).isDisabled(), 'Last short page should disable next');

  await page.goto(baseUrl + '/projects?page=2');
  await page.getByRole('heading', { name: 'Проєктів не знайдено' }).waitFor();
  await page.getByRole('button', { name: /Попередня/ }).click();
  await page.getByText(first.title, { exact: true }).waitFor();

  await page.route('**/api/projects?*', (route) => route.abort());
  await page.getByRole('button', { name: /Оновити дані/ }).click();
  await page.getByRole('alert').waitFor();
  await page.unroute('**/api/projects?*');
  await page.getByRole('button', { name: 'Спробувати ще раз' }).click();
  await page.getByText(first.title, { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Project table should not overflow the page');
  await page.screenshot({ path: '.tmp/tasko-projects-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });

  await signIn(freelancer);
  assert(await page.getByTestId('active-projects').textContent() === '1', 'Freelancer statistics are scoped');
  await page.getByRole('link', { name: 'Мої проєкти', exact: true }).click();
  await page.getByText(first.title, { exact: true }).waitFor();
  assert(await page.getByText(second.title, { exact: true }).count() === 0, 'Private project must not be visible to freelancer');
  await call('get', `/projects/${second.id}`, undefined, freelancer.token, 403);
  assert(errors.length === 0, 'Unexpected browser errors: ' + errors.join(', '));
  console.log('Dashboard and project browser checks passed. Two isolated accounts, two projects and one task were preserved; existing data was not deleted.');
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(baseUrl + '/login');
}
