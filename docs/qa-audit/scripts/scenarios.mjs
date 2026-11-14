// Наскрізні HTTP-сценарії проти локального API на QA-базі (http://127.0.0.1:3100).
// Кожна перевірка пише рядок {id, area, title, expected, actual, status} у results.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const base = 'http://127.0.0.1:3100';
const [accountsPath, outPath, phase] = process.argv.slice(2);
const demoPassword = JSON.parse(readFileSync(accountsPath, 'utf8')).password;
const results = [];
let n = 0;

async function req(method, path, token, body, extra = {}) {
  const headers = { ...(extra.headers ?? {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload = body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  } else if (typeof body === 'string') headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
function check(area, title, expected, actual, ok) {
  results.push({ id: `T${String(++n).padStart(3, '0')}`, area, title, expected, actual: String(actual).slice(0, 300), status: ok ? 'PASS' : 'FAIL' });
}
const expectStatus = (area, title, r, want) =>
  check(area, title, `HTTP ${want}`, `HTTP ${r.status}${r.status !== want ? ' ' + JSON.stringify(r.data).slice(0, 200) : ''}`, r.status === want);

async function login(email, password = demoPassword) {
  const r = await req('POST', '/auth/login', null, { email, password });
  return r.data.accessToken;
}
async function register(role) {
  const email = `qa-${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `Qa-${randomUUID()}`;
  const r = await req('POST', '/auth/register', null, { name: `QA ${role}`, email, password, role });
  return { email, password, r };
}

try {
  // ---------- Авторизація та валідація ----------
  const A = 'Auth';
  // Ліміт реєстрацій — 10 з IP за 15 хв, тож негативні перевірки йдуть окремим запуском після перезапуску API
  if (phase === 'neg') {
  expectStatus(A, 'Реєстрація з порожнім тілом', await req('POST', '/auth/register', null, {}), 400);
  expectStatus(A, 'Реєстрація з невалідною поштою', await req('POST', '/auth/register', null, { name: 'Тест', email: 'not-email', password: 'Password123', role: 'CLIENT' }), 400);
  expectStatus(A, 'Пароль коротший за 8 символів', await req('POST', '/auth/register', null, { name: 'Тест', email: 'short@example.test', password: '1234567', role: 'CLIENT' }), 400);
  expectStatus(A, 'Пароль довший за 128 символів', await req('POST', '/auth/register', null, { name: 'Тест', email: 'long@example.test', password: 'x'.repeat(129), role: 'CLIENT' }), 400);
  expectStatus(A, "Ім'я з емодзі", await req('POST', '/auth/register', null, { name: 'Тест 😀', email: 'emoji@example.test', password: 'Password123', role: 'CLIENT' }), 400);
  expectStatus(A, 'Реєстрація з роллю ADMIN', await req('POST', '/auth/register', null, { name: 'Хакер', email: 'adm@example.test', password: 'Password123', role: 'ADMIN' }), 400);
  expectStatus(A, 'Зайве поле isAdmin відхиляється', await req('POST', '/auth/register', null, { name: 'Тест', email: 'extra@example.test', password: 'Password123', role: 'CLIENT', isAdmin: true }), 400);
  let limited = 0;
  for (let i = 0; i < 5; i++) if ((await req('POST', '/auth/register', null, {})).status === 429) limited++;
  check(A, 'Ліміт реєстрацій: 11-й запит з IP за 15 хв', 'HTTP 429', `${limited} з 5 запитів отримали 429`, limited > 0);
  throw Object.assign(new Error('neg-done'), { done: true });
  }
  const client = await register('CLIENT');
  expectStatus(A, 'Реєстрація клієнта', client.r, 201);
  const freelancer = await register('FREELANCER');
  expectStatus(A, 'Реєстрація фрілансера', freelancer.r, 201);
  const other2 = await register('FREELANCER');
  check(A, 'Відповідь реєстрації без passwordHash/twoFactorSecret', 'немає секретних полів', Object.keys(client.r.data).join(','), !('passwordHash' in client.r.data) && !('twoFactorSecret' in client.r.data));
  expectStatus(A, 'Повторна реєстрація тієї ж пошти', await req('POST', '/auth/register', null, { name: 'Дубль', email: client.email, password: 'Password123', role: 'CLIENT' }), 409);
  expectStatus(A, 'Повторна реєстрація пошти в іншому регістрі', await req('POST', '/auth/register', null, { name: 'Дубль', email: client.email.toUpperCase(), password: 'Password123', role: 'CLIENT' }), 409);
  expectStatus(A, 'Вхід з неправильним паролем', await req('POST', '/auth/login', null, { email: client.email, password: 'wrong-password' }), 401);
  expectStatus(A, 'Вхід з неіснуючою поштою', await req('POST', '/auth/login', null, { email: 'nobody@example.test', password: 'wrong-password' }), 401);
  const wrongA = await req('POST', '/auth/login', null, { email: client.email, password: 'wrong-password' });
  const wrongB = await req('POST', '/auth/login', null, { email: 'nobody@example.test', password: 'wrong-password' });
  check(A, 'Однакова помилка для неіснуючої пошти й неправильного пароля', 'однакові тексти', `${wrongA.data.message} | ${wrongB.data.message}`, wrongA.data.message === wrongB.data.message);
  let bruteLimited = false;
  for (let i = 0; i < 15; i++) {
    const r = await req('POST', '/auth/login', null, { email: 'brute-victim@example.test', password: `wrong-${i}` });
    if (r.status === 429) { bruteLimited = true; break; }
  }
  check(A, 'Ліміт спроб входу (15 неправильних паролів поспіль)', 'HTTP 429 до 15-ї спроби', bruteLimited ? '429 отримано' : 'усі 15 спроб — 401, ліміту немає', bruteLimited);
  const cTok = await login(client.email, client.password);
  const fTok = await login(freelancer.email, freelancer.password);
  check(A, 'Вхід видає JWT', 'accessToken', cTok ? 'є токен' : 'немає', Boolean(cTok && fTok));
  expectStatus(A, '/auth/me без токена', await req('GET', '/auth/me'), 401);
  expectStatus(A, '/auth/me зі сміттєвим токеном', await req('GET', '/auth/me', 'abc.def.ghi'), 401);
  const [h, p] = cTok.split('.');
  const forged = `${h}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: randomUUID() })).toString('base64url')}.${cTok.split('.')[2]}`;
  expectStatus(A, 'Токен зі зміненим sub (підпис не збігається)', await req('GET', '/auth/me', forged), 401);
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`;
  expectStatus(A, 'Токен з alg=none', await req('GET', '/auth/me', none), 401);
  const me = await req('GET', '/auth/me', cTok);
  expectStatus(A, '/auth/me з дійсним токеном', me, 200);
  check(A, '/auth/me не віддає sessionId і хеш пароля', 'немає', Object.keys(me.data).join(','), !('sessionId' in me.data) && !('passwordHash' in me.data));
  expectStatus(A, 'Зміна ролі на ADMIN через profile/role', await req('PATCH', '/profile/role', cTok, { role: 'ADMIN' }), 400);
  const extraTok = await login(client.email, client.password);
  const sessions = await req('GET', '/auth/sessions', cTok);
  check(A, 'Список сеансів показує обидва входи', '>= 2 сеанси', `${sessions.data.length} сеансів`, sessions.status === 200 && sessions.data.length >= 2);
  const other = sessions.data.find((s) => !s.current);
  expectStatus(A, 'Завершення іншого сеансу', await req('DELETE', `/auth/sessions/${other.id}`, cTok), 200);
  expectStatus(A, 'Токен завершеного сеансу більше не діє', await req('GET', '/auth/me', extraTok), 401);
  const sessionsF = await req('GET', '/auth/sessions', fTok);
  expectStatus(A, 'Завершення чужого сеансу (IDOR)', await req('DELETE', `/auth/sessions/${sessionsF.data[0].id}`, cTok), 404);
  expectStatus(A, 'Зміна пароля з неправильним поточним', await req('PATCH', '/auth/password', cTok, { currentPassword: 'wrong-pass', newPassword: 'NewPassword123' }), 400);
  expectStatus(A, 'Увімкнення 2FA з неправильним кодом', await req('POST', '/auth/2fa/enable', cTok, { code: '000000' }), 400);
  const setup = await req('POST', '/auth/2fa/setup', cTok);
  check(A, 'Налаштування 2FA повертає секрет і QR', 'secret + qrCode', Object.keys(setup.data).join(','), setup.status === 201 && setup.data.secret && String(setup.data.qrCode).startsWith('data:image/png'));

  // ---------- Біржа і модерація ----------
  const M = 'Marketplace';
  const adminTok = await login('admin@tasko.ai');
  check(M, 'Вхід демо-адміністратора', 'токен', adminTok ? 'є' : 'немає', Boolean(adminTok));
  expectStatus(M, 'Фрілансер не може створити проєкт', await req('POST', '/projects', fTok, { title: 'Не можна' }), 403);
  expectStatus(M, 'Бюджет min > max', await req('POST', '/projects', cTok, { title: 'Бюджет', budgetMin: 500, budgetMax: 100 }), 400);
  expectStatus(M, 'Дедлайн у минулому', await req('POST', '/projects', cTok, { title: 'Дедлайн', deadline: '2020-01-01T00:00:00.000Z' }), 400);
  const deadline = new Date(Date.now() + 30 * 864e5).toISOString();
  const project = await req('POST', '/projects', cTok, { title: 'QA лендінг', description: 'Перевірка повного циклу', budgetMin: 1000, budgetMax: 5000, deadline });
  expectStatus(M, 'Клієнт створює проєкт', project, 201);
  const pid = project.data.id;
  check(M, 'Новий проєкт іде на модерацію', 'status MODERATION', project.data.status, project.data.status === 'MODERATION');
  expectStatus(M, 'Клієнт не може сам опублікувати проєкт з модерації', await req('PATCH', `/projects/${pid}`, cTok, { status: 'PLANNING' }), 409);
  let market = await req('GET', '/marketplace/projects?limit=50', fTok);
  check(M, 'Непромодерований проєкт не видно на біржі', 'немає в списку', market.data.some?.((x) => x.id === pid) ? 'є в списку' : 'немає', !market.data.some?.((x) => x.id === pid));
  expectStatus(M, 'Клієнт не має доступу до адмін-модерації', await req('GET', '/admin/moderation/projects', cTok), 403);
  expectStatus(M, 'Адмін схвалює проєкт', await req('POST', `/admin/moderation/projects/${pid}`, adminTok, { decision: 'APPROVE' }), 201);
  market = await req('GET', '/marketplace/projects?limit=50', fTok);
  check(M, 'Схвалений проєкт видно на біржі', 'є в списку', market.data.some((x) => x.id === pid) ? 'є' : 'немає', market.data.some((x) => x.id === pid));
  const searched = await req('GET', '/marketplace/projects?search=QA%20лендінг', fTok);
  check(M, 'Пошук на біржі знаходить проєкт', 'знайдено', searched.data.length, searched.data.some?.((x) => x.id === pid));
  const budgetFiltered = await req('GET', '/marketplace/projects?minBudget=999999', fTok);
  check(M, 'Фільтр бюджету відсікає проєкт', 'немає', budgetFiltered.data.some?.((x) => x.id === pid) ? 'є' : 'немає', !budgetFiltered.data.some?.((x) => x.id === pid));
  expectStatus(M, 'Клієнт не бачить біржу', await req('GET', '/marketplace/projects', cTok), 403);
  expectStatus(M, 'Додати в обрані', await req('POST', `/projects/${pid}/favorite`, fTok), 201);
  const favs = await req('GET', '/marketplace/projects?favoritesOnly=true', fTok);
  check(M, 'Фільтр «лише обрані»', 'є проєкт', favs.data.length, favs.data.some?.((x) => x.id === pid));
  const edited = await req('PATCH', `/projects/${pid}`, cTok, { title: 'КУПУЙТЕ КРИПТУ НА scam.example' });
  check(M, 'Редагування опублікованого проєкту повертає його на модерацію', 'status MODERATION', `${edited.status} ${edited.data.status} «${edited.data.title}»`, edited.data.status === 'MODERATION');
  await req('PATCH', `/projects/${pid}`, cTok, { title: 'QA лендінг' });
  // Після виправлення BUG-03 змінений проєкт знову на модерації: адмін схвалює ще раз
  if (edited.data.status === 'MODERATION')
    expectStatus(M, 'Повторне схвалення після редагування', await req('POST', `/admin/moderation/projects/${pid}`, adminTok, { decision: 'APPROVE' }), 201);
  expectStatus(M, 'Ставка вища за максимальний бюджет', await req('POST', `/projects/${pid}/applications`, fTok, { message: 'Хочу виконати цей проєкт', proposedBudget: 999999, proposedDays: 10 }), 400);
  expectStatus(M, 'Коротке повідомлення заявки', await req('POST', `/projects/${pid}/applications`, fTok, { message: 'коротко', proposedBudget: 2000, proposedDays: 10 }), 400);
  expectStatus(M, 'Клієнт не може подати заявку', await req('POST', `/projects/${pid}/applications`, cTok, { message: 'Хочу виконати цей проєкт', proposedBudget: 2000, proposedDays: 10 }), 403);
  const app = await req('POST', `/projects/${pid}/applications`, fTok, { message: 'Хочу виконати цей проєкт', proposedBudget: 3000, proposedDays: 10 });
  expectStatus(M, 'Фрілансер подає заявку', app, 201);
  expectStatus(M, 'Дублікат заявки', await req('POST', `/projects/${pid}/applications`, fTok, { message: 'Хочу виконати цей проєкт ще раз', proposedBudget: 3000, proposedDays: 10 }), 409);
  expectStatus(M, 'Відкликання заявки', await req('POST', `/applications/${app.data.id}/withdraw`, fTok), 201);
  const reapply = await req('POST', `/projects/${pid}/applications`, fTok, { message: 'Подаю заявку повторно', proposedBudget: 3000, proposedDays: 10 });
  expectStatus(M, 'Повторне подання після відкликання', reapply, 201);
  const oTok = await login(other2.email, other2.password);
  expectStatus(M, 'Інший фрілансер не бачить заявки проєкту', await req('GET', `/projects/${pid}/applications`, oTok), 403);
  expectStatus(M, 'Інший фрілансер не може прийняти заявку', await req('POST', `/applications/${reapply.data.id}/accept`, oTok), 403);
  expectStatus(M, 'Чужий фрілансер не може відкликати заявку', await req('POST', `/applications/${reapply.data.id}/withdraw`, oTok), 403);
  expectStatus(M, 'Чат заявки: чужий не має доступу', await req('GET', `/applications/${reapply.data.id}/messages`, oTok), 403);
  expectStatus(M, 'Чат заявки: повідомлення клієнта', await req('POST', `/applications/${reapply.data.id}/messages`, cTok, { content: 'Вітаю! Маєте приклади робіт?' }), 201);
  const apps = await req('GET', `/projects/${pid}/applications`, cTok);
  check(M, 'Клієнт бачить заявки з профілем фрілансера', 'freelancer у кожній', apps.data.length, apps.status === 200 && apps.data.every((x) => x.freelancer));
  expectStatus(M, 'Прийняття заявки', await req('POST', `/applications/${reapply.data.id}/accept`, cTok), 201);
  expectStatus(M, 'Повторне прийняття тієї ж заявки', await req('POST', `/applications/${reapply.data.id}/accept`, cTok), 409);
  const pAfter = await req('GET', `/projects/${pid}`, cTok);
  check(M, 'Після найму проєкт стає ACTIVE', 'ACTIVE', pAfter.data.status, pAfter.data.status === 'ACTIVE');
  expectStatus(M, 'Чат заявки закрито після прийняття', await req('POST', `/applications/${reapply.data.id}/messages`, fTok, { content: 'ще одне' }), 409);

  // ---------- Проєкт, завдання, здача робіт ----------
  const P = 'Project';
  expectStatus(P, 'Сторонній фрілансер не бачить проєкт', await req('GET', `/projects/${pid}`, oTok), 403);
  expectStatus(P, 'Сторонній не читає повідомлення проєкту', await req('GET', `/projects/${pid}/messages`, oTok), 403);
  expectStatus(P, 'Сторонній не бачить файли проєкту', await req('GET', `/projects/${pid}/files`, oTok), 403);
  expectStatus(P, 'Призначити виконавцем не учасника', await req('POST', `/projects/${pid}/tasks`, cTok, { title: 'Чужий', assigneeId: other2.r.data.id }), 400);
  expectStatus(P, 'Дедлайн завдання пізніше дедлайну проєкту', await req('POST', `/projects/${pid}/tasks`, cTok, { title: 'Пізно', deadline: new Date(Date.now() + 90 * 864e5).toISOString() }), 400);
  expectStatus(P, 'Фрілансер не створює завдання', await req('POST', `/projects/${pid}/tasks`, fTok, { title: 'Сам собі' }), 403);
  const task = await req('POST', `/projects/${pid}/tasks`, cTok, { title: 'Зверстати головну', description: 'Адаптивно', assigneeId: freelancer.r.data.id, priority: 'HIGH' });
  expectStatus(P, 'Клієнт створює завдання з виконавцем', task, 201);
  const tid = task.data.id;
  expectStatus(P, 'Сторонній не змінює статус завдання', await req('PATCH', `/tasks/${tid}/status`, oTok, { status: 'IN_PROGRESS' }), 403);
  expectStatus(P, 'Статус DONE напряму заборонено', await req('PATCH', `/tasks/${tid}/status`, fTok, { status: 'DONE' }), 400);
  expectStatus(P, 'Здати роботу до старту завдання', await req('POST', `/tasks/${tid}/submissions`, fTok, { description: 'Готово' }), 409);
  expectStatus(P, 'Виконавець бере завдання в роботу', await req('PATCH', `/tasks/${tid}/status`, fTok, { status: 'IN_PROGRESS' }), 200);
  const fd = new FormData();
  fd.append('file', new Blob(['Звіт про роботу\n'], { type: 'text/plain' }), 'report.txt');
  const file = await req('POST', `/projects/${pid}/files`, fTok, fd);
  expectStatus(P, 'Завантаження TXT-файлу', file, 201);
  const fake = new FormData();
  fake.append('file', new Blob(['<script>alert(1)</script>'], { type: 'application/pdf' }), 'evil.pdf');
  expectStatus(P, 'PDF з неправильною сигнатурою відхиляється', await req('POST', `/projects/${pid}/files`, fTok, fake), 400);
  const html = new FormData();
  html.append('file', new Blob(['<html><script>alert(1)</script></html>'], { type: 'text/html' }), 'x.html');
  expectStatus(P, 'HTML-файл відхиляється', await req('POST', `/projects/${pid}/files`, fTok, html), 400);
  const trav = new FormData();
  trav.append('file', new Blob(['ok'], { type: 'text/plain' }), '../../etc/passwd.txt');
  const travR = await req('POST', `/projects/${pid}/files`, fTok, trav);
  check(P, 'Path traversal в імені файлу знешкоджено', 'ім\'я без ../', `${travR.status} ${travR.data.fileName}`, travR.status === 201 && !String(travR.data.fileName).includes('..'));
  expectStatus(P, 'Сторонній не завантажує файл проєкту (IDOR)', await req('GET', `/files/${file.data.id}/download`, oTok), 403);
  const adminDl = await req('GET', `/files/${file.data.id}/download`, adminTok);
  check(P, 'Адмін не завантажує приватний файл проєкту', 'HTTP 403 (правило adminBypass=false)', `HTTP ${adminDl.status}`, adminDl.status === 403);
  const dl = await fetch(`${base}/files/${file.data.id}/download`, { headers: { authorization: `Bearer ${cTok}` } });
  check(P, 'Завантаження файлу учасником + безпечні заголовки', 'attachment і nosniff', `${dl.status} ${dl.headers.get('content-disposition')} ${dl.headers.get('x-content-type-options')}`, dl.status === 200 && /attachment/.test(dl.headers.get('content-disposition') ?? '') && dl.headers.get('x-content-type-options') === 'nosniff');
  const sub1 = await req('POST', `/tasks/${tid}/submissions`, fTok, { description: 'Перша версія', fileIds: [file.data.id] });
  expectStatus(P, 'Здача роботи з файлом', sub1, 201);
  expectStatus(P, 'Той самий файл у другій здачі', await req('POST', `/tasks/${tid}/submissions`, fTok, { description: 'ще', fileIds: [file.data.id] }), 409);
  expectStatus(P, 'Видалити файл, що вже в зданій роботі', await req('DELETE', `/files/${file.data.id}`, fTok), 409);
  expectStatus(P, 'Фрілансер не перевіряє власну роботу', await req('POST', `/submissions/${sub1.data.id}/review`, fTok, { decision: 'APPROVE', feedback: 'ок' }), 403);
  expectStatus(P, 'Повернення на доопрацювання', await req('POST', `/submissions/${sub1.data.id}/review`, cTok, { decision: 'NEEDS_REVISION', feedback: 'Додайте мобільну версію' }), 201);
  expectStatus(P, 'Повторна перевірка тієї ж здачі', await req('POST', `/submissions/${sub1.data.id}/review`, cTok, { decision: 'APPROVE', feedback: 'ок' }), 409);
  const tAfter = await req('GET', `/tasks/${tid}`, fTok);
  check(P, 'Після доопрацювання завдання знову IN_PROGRESS', 'IN_PROGRESS', tAfter.data.status, tAfter.data.status === 'IN_PROGRESS');
  const sub2 = await req('POST', `/tasks/${tid}/submissions`, fTok, { description: 'Друга версія з мобільною' });
  expectStatus(P, 'Повторна здача', sub2, 201);
  expectStatus(P, 'Прийняття роботи', await req('POST', `/submissions/${sub2.data.id}/review`, cTok, { decision: 'APPROVE', feedback: 'Чудово' }), 201);
  expectStatus(P, 'Редагування прийнятого завдання', await req('PATCH', `/tasks/${tid}`, cTok, { title: 'Нова назва' }), 409);
  const orders = await req('GET', `/projects/${pid}/orders`, cTok);
  check(P, 'Після найму створено замовлення на ставку заявки', 'amount 3000', orders.data[0]?.amount, orders.data[0]?.amount === 3000);
  expectStatus(P, 'Фрілансер не закриває замовлення', await req('PATCH', `/orders/${orders.data[0].id}`, fTok, { status: 'COMPLETED' }), 403);
  expectStatus(P, 'Клієнт закриває замовлення', await req('PATCH', `/orders/${orders.data[0].id}`, cTok, { status: 'COMPLETED' }), 200);
  expectStatus(P, 'Повторне закриття замовлення', await req('PATCH', `/orders/${orders.data[0].id}`, cTok, { status: 'COMPLETED' }), 409);
  expectStatus(P, 'Відгук до завершення проєкту', await req('POST', `/projects/${pid}/reviews`, cTok, { freelancerId: freelancer.r.data.id, rating: 5, comment: 'Рано' }), 409);
  expectStatus(P, 'Завершення проєкту', await req('PATCH', `/projects/${pid}`, cTok, { status: 'COMPLETED' }), 200);
  expectStatus(P, 'Нове завдання в закритому проєкті', await req('POST', `/projects/${pid}/tasks`, cTok, { title: 'Після' }), 409);
  expectStatus(P, 'Повідомлення в закритому проєкті', await req('POST', `/projects/${pid}/messages`, fTok, { content: 'привіт' }), 409);
  expectStatus(P, 'Відгук клієнта про фрілансера', await req('POST', `/projects/${pid}/reviews`, cTok, { freelancerId: freelancer.r.data.id, rating: 5, comment: 'Рекомендую' }), 201);
  expectStatus(P, 'Повторний відгук', await req('POST', `/projects/${pid}/reviews`, cTok, { freelancerId: freelancer.r.data.id, rating: 1 }), 409);
  expectStatus(P, 'Оцінка 6 відхиляється', await req('POST', `/projects/${pid}/client-review`, fTok, { rating: 6 }), 400);
  expectStatus(P, 'Відгук фрілансера про клієнта', await req('POST', `/projects/${pid}/client-review`, fTok, { rating: 5, comment: 'Чіткі вимоги' }), 201);
  expectStatus(P, 'Сторонній не залишає відгук', await req('POST', `/projects/${pid}/client-review`, oTok, { rating: 1 }), 403);
  const profile = await req('GET', `/freelancers/${freelancer.r.data.id}/profile`, cTok);
  check(P, 'Відгук видно в профілі фрілансера', 'рейтинг 5', JSON.stringify(profile.data).match(/"rating":\s*\d/)?.[0], JSON.stringify(profile.data).includes('Рекомендую'));
  const activity = await req('GET', `/projects/${pid}/activity`, cTok);
  check(P, 'Журнал активності містить події циклу', '>= 5 подій', activity.data.length, activity.status === 200 && activity.data.length >= 5);

  // ---------- Скарги та адміністрування ----------
  const C = 'Admin';
  const complaint = await req('POST', '/complaints', fTok, { targetUserId: other2.r.data.id, reason: 'Спам', description: 'Надсилає рекламу в чатах' });
  check(C, 'Скарга на користувача без спільного проєкту', 'HTTP 201 або 400 з поясненням', `HTTP ${complaint.status} ${JSON.stringify(complaint.data).slice(0, 120)}`, [201, 400, 403].includes(complaint.status));
  expectStatus(C, 'Не-адмін не бачить скарги адміністратора', await req('GET', '/admin/complaints', cTok), 403);
  expectStatus(C, 'Не-адмін не бачить користувачів', await req('GET', '/admin/users', cTok), 403);
  expectStatus(C, 'Не-адмін не створює адміністратора', await req('POST', '/admin/admins', cTok, { name: 'Ще адмін', email: 'x@example.test', password: 'Password123' }), 403);
  expectStatus(C, 'Не-адмін не завантажує звіт', await req('GET', '/admin/report/export?format=csv', fTok), 403);
  for (const format of ['json', 'csv', 'xlsx', 'pdf']) {
    const r = await fetch(`${base}/admin/report/export?format=${format}`, { headers: { authorization: `Bearer ${adminTok}` } });
    const size = (await r.arrayBuffer()).byteLength;
    check(C, `Експорт звіту ${format}`, 'HTTP 200, непорожній файл', `${r.status}, ${size} байт, ${r.headers.get('content-type')}`, r.status === 200 && size > 100);
  }
  const users = await req('GET', '/admin/users?search=admin%40tasko.ai', adminTok);
  const adminId = users.data.items?.[0]?.id ?? users.data[0]?.id;
  expectStatus(C, 'Адмін не може заблокувати адміністратора', await req('PATCH', `/admin/users/${adminId}`, adminTok, { status: 'BLOCKED', blockReason: 'тест' }), 403);
  expectStatus(C, 'Адмін блокує користувача', await req('PATCH', `/admin/users/${other2.r.data.id}`, adminTok, { status: 'BLOCKED', blockReason: 'Порушення правил' }), 200);
  expectStatus(C, 'Токен заблокованого більше не працює', await req('GET', '/auth/me', oTok), 403);
  expectStatus(C, 'Заблокований не може увійти', await req('POST', '/auth/login', null, { email: other2.email, password: other2.password }), 403);

  // ---------- Ada без ключа ----------
  const AI = 'Ada';
  const status = await req('GET', '/agent/status', cTok);
  check(AI, 'Статус Ади без ключа AI', 'available=false', JSON.stringify(status.data), status.status === 200 && JSON.stringify(status.data).includes('false'));
  const chat = await req('POST', '/agent/chat', cTok, { message: 'Які в мене проєкти?' });
  check(AI, 'Чат без ключа повертає зрозумілу помилку', 'HTTP 503 з поясненням', `HTTP ${chat.status} ${JSON.stringify(chat.data).slice(0, 150)}`, chat.status === 503);
  expectStatus(AI, 'MCP без токена', await req('POST', '/mcp', null, {}), 401);
  expectStatus(AI, 'MCP GET відхиляється', await req('GET', '/mcp', cTok), 405);
  const mcp = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${fTok}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_project_messages', arguments: { projectId: pid } } }) });
  const mcpText = await mcp.text();
  check(AI, 'MCP-інструмент поважає права (фрілансер-учасник читає чат свого проєкту)', 'відповідь без помилки доступу', mcpText.slice(0, 160), mcp.status === 200 && !mcpText.includes('Немає доступу'));
  const mcp2 = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${cTok}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_users', arguments: {} } }) });
  const mcp2Text = await mcp2.text();
  check(AI, 'Клієнту недоступний адмінський MCP-інструмент search_users', 'помилка «tool not found»', mcp2Text.slice(0, 160), /not found|isError|-32602|Unknown/i.test(mcp2Text));

  // ---------- Загальні API-перевірки ----------
  const G = 'API';
  expectStatus(G, 'Невідомий маршрут', await req('GET', '/nope', cTok), 404);
  expectStatus(G, 'Неправильний JSON', await req('POST', '/auth/login', null, '{"email":'), 400);
  expectStatus(G, 'Неправильний UUID у шляху', await req('GET', '/projects/not-a-uuid', cTok), 400);
  expectStatus(G, 'Неіснуючий проєкт', await req('GET', `/projects/${randomUUID()}`, cTok), 404);
  expectStatus(G, 'Ліміт сторінки > 50', await req('GET', '/projects?limit=1000', cTok), 400);
  const health = await req('GET', '/health');
  expectStatus(G, 'Health-check', health, 200);
  const anyRes = await fetch(`${base}/health`);
  check(G, 'Заголовок X-Powered-By прихований', 'немає', anyRes.headers.get('x-powered-by'), !anyRes.headers.get('x-powered-by'));
  const cors = await fetch(`${base}/auth/me`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
  check(G, 'CORS не дозволяє чужий origin', 'немає ACAO для evil.example', cors.headers.get('access-control-allow-origin'), cors.headers.get('access-control-allow-origin') !== 'https://evil.example' && cors.headers.get('access-control-allow-origin') !== '*');
  const docs = await fetch(`${base}/docs`);
  check(G, 'Swagger /docs публічний', 'інформаційно', `HTTP ${docs.status}`, true);
  const big = await req('POST', '/auth/login', null, JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(200000) }));
  check(G, 'Дуже великий JSON (200 КБ)', 'HTTP 413 або 400', `HTTP ${big.status}`, [400, 413].includes(big.status));
} catch (error) {
  if (!error?.done) results.push({ id: 'ERR', area: 'runner', title: 'Аварія сценарію', expected: '-', actual: String(error?.stack ?? error).slice(0, 500), status: 'BLOCKED' });
}
writeFileSync(outPath, JSON.stringify(results, null, 2));
const by = results.reduce((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});
console.log(JSON.stringify(by));
for (const r of results.filter((x) => x.status !== 'PASS')) console.log(r.id, r.status, r.area, '|', r.title, '|', r.actual);
