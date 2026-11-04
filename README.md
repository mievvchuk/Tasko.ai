<p align="center"><img src="apps/web/public/favicon.svg" width="90" alt="Логотип Tasko.ai"></p>

<h1 align="center">Tasko.ai</h1>

<p align="center">Біржа фрілансу та робочий простір для управління проєктами з AI-помічником.</p>

<p align="center"><strong>🇺🇦 Українська</strong> · <a href="README.en.md">🇬🇧 English</a> · <a href="https://taskoai.pp.ua">Відкрити Tasko.ai</a></p>

<p align="center">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
<img alt="React" src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react">
<img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white">
<img alt="NestJS" src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs">
<img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white">
<img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma">
</p>


**Tasko.ai** — курсовий проєкт: біржа фрілансу та система управління проєктами з AI-помічником. Платформа об’єднує замовників і виконавців: від публікації проєкту та вибору фрілансера до виконання завдань і приймання результату.

## Можливості

- **Біржа:** публікація проєктів, категорії та бюджет, пошук і фільтри, обрані проєкти, заявки й вибір виконавця.
- **Профілі фрілансерів:** навички, портфоліо, рейтинг, досвід і відгуки.
- **Керування проєктами:** учасники, завдання, Kanban-дошка з власними колонками, етапи, дедлайни, замовлення та журнал активності.
- **Співпраця:** повідомлення, файли, здача робіт, повернення на доопрацювання та приймання результатів.
- **AI-помічниця Ada:** відповіді на запитання за доступними користувачу даними, створення чернетки проєкту в діалозі, порівняння заявок і формування редагованого плану.
- **Аналітика:** прогрес, дедлайни та завантаженість виконавців.
- **Безпека та адміністрування:** JWT, керування сеансами, зміна пароля, TOTP 2FA, модерація та експорт звітів.
- **Інтерфейс:** українська й англійська мови, світла, темна та системна теми, адаптація до мобільних екранів.

> Статуси оплати етапів призначені для обліку. Tasko.ai не здійснює перекази коштів.

## Як це працює

```mermaid
flowchart LR
  A[Замовник публікує проєкт] --> B[Фрілансер подає заявку]
  B --> C[Замовник обирає виконавця]
  C --> D[Команда працює над завданнями]
  D --> E[Фрілансер здає роботу]
  E --> F[Замовник перевіряє та приймає]
  F --> G[Завершення проєкту й відгук]
```

## Технології

| Частина | Технології |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | NestJS, TypeScript, REST API, Swagger |
| База даних | PostgreSQL, Prisma |
| AI | OpenAI-сумісний API, Model Context Protocol (MCP) |
| Тестування | Vitest, Node.js test runner, інтеграційні HTTP-тести |

## Початок роботи

### Вимоги

- Node.js **22.22 або новіший** і npm
- PostgreSQL **15 або новіший**
- Git

### 1. Клонування та налаштування

```bash
git clone https://github.com/mievvchuk/Tasko.ai.git
cd Tasko.ai
```

Створіть кореневий файл `.env` на основі [`.env.example`](.env.example) та заповніть щонайменше:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tasko
JWT_SECRET=your-long-random-secret
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

Замініть приклад адреси БД і секрет власними значеннями. База даних має існувати, а користувач PostgreSQL — мати права на створення таблиць. Не додавайте `.env` до Git.

### 2. Запуск API

```bash
cd apps/api
npm ci --ignore-scripts
npm run db:migrate
npm run db:verify
npm run start:dev
```

API за замовчуванням доступний на **http://localhost:3000**:

- Swagger: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json
- Перевірка стану: http://localhost:3000/health

Для production-збірки використовуйте `npm run build`, а потім `npm run start:prod`.

### 3. Запуск вебзастосунку

Відкрийте інший термінал із кореня репозиторію:

```bash
cd apps/web
npm ci --ignore-scripts
npm run dev
```

Відкрийте **http://127.0.0.1:5173**. За замовчуванням Vite перенаправляє запити `/api` на `http://localhost:3000`. Для іншої адреси використайте [`apps/web/.env.example`](apps/web/.env.example): `API_PROXY_TARGET` задає адресу сервера для проксі, а `VITE_API_URL` — публічну адресу API.

У Windows, якщо PowerShell блокує `npm.ps1`, використовуйте `npm.cmd` замість `npm`.

## Ролі та сценарій роботи

| Роль | Основні можливості |
| --- | --- |
| Замовник | Публікує проєкт, обирає виконавця, створює завдання та приймає роботу |
| Фрілансер | Шукає проєкти, подає заявки, виконує завдання та надсилає результати |
| Адміністратор | Керує користувачами, розглядає скарги та формує звіти |

Зареєструйте замовника та фрілансера, створіть проєкт, подайте заявку й оберіть виконавця. Після цього можна призначити завдання, передати результат на перевірку та завершити проєкт. Для двох одночасних сеансів використовуйте різні вкладки або браузери.

Першого адміністратора створюють окремо: задайте `ADMIN_NAME`, `ADMIN_EMAIL` і `ADMIN_PASSWORD` у кореневому `.env`, потім у `apps/api` виконайте `npm run admin:create`. Після створення приберіть пароль із файлу.

### Демонстраційні дані

Для локальної БД у каталозі `apps/api` виконайте:

```bash
npm run seed:demo
```

Команда додає приклади користувачів і робочих даних. Адреси та згенерований пароль зберігаються в ігнорованому Git файлі `.tmp/demo-accounts.json`. Повторний запуск пропускає вже створені демонстраційні записи.

## Налаштування AI

У кореневому `.env` задайте:

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=your-model
```

Потрібен HTTPS OpenAI-сумісний провайдер і модель із підтримкою виклику інструментів. Перезапустіть API після зміни налаштувань. Без налаштованого провайдера функції AI недоступні.

AI-помічник використовує MCP-інструменти для читання доступних користувачу проєктів, завдань, дедлайнів і завантаженості. Окремий MCP-сервер запускати не потрібно. AI-планування створює редаговану чернетку; етапи й завдання зберігаються лише після підтвердження користувача.

## Пошта

Підтвердження пошти під час реєстрації не потрібне, а сервіс не надсилає листів, тож SMTP налаштовувати не треба.

## Перевірки

Команди API з каталогу `apps/api`:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:integration
npm run db:verify
```

Інтеграційний тест потребує доступної PostgreSQL і відкочує власні тестові записи. Окрема команда `npm run test:ai` додатково звертається до налаштованого AI-провайдера та витрачає його квоту.

Команди вебзастосунку з каталогу `apps/web`:

```bash
npm test
npm run typecheck
npm run build
```

## Структура проєкту

```text
apps/
  api/
    src/             модулі NestJS і схема Prisma
    migrations/      міграції бази даних
    test/            HTTP та інтеграційні тести
  web/
    src/             React-застосунок
    test/            тести та браузерні сценарії
docs/
  diagrams/          UML та архітектурні діаграми
  IMPLEMENTATION_NOTES.md
.env.example         приклад налаштувань
```

Деталі реалізації та історію перевірок наведено в [нотатках про реалізацію](docs/IMPLEMENTATION_NOTES.md), а діаграми — у [документації діаграм](docs/diagrams/README.md). Повний перелік API-маршрутів і параметрів доступний у Swagger після запуску сервера.
