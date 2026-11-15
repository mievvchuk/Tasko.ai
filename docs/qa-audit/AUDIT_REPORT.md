# Аудит Tasko.ai

Дата: 2026-11-14. Об'єкт: репозиторій `mievvchuk/Tasko.ai`, гілка `main` @ `28a5f2b`, і сайт https://taskoai.pp.ua (на production лише GET/HEAD).

Інші звіти: [TEST_MATRIX.md](TEST_MATRIX.md) · [BUG_REPORT.md](BUG_REPORT.md) · [UI_UX_REPORT.md](UI_UX_REPORT.md) · [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) · скрипти в [scripts/](scripts/).

## Головне питання

**Чи готовий Tasko.ai до стабільного публічного використання? Поки що ні.** Продукт функціонально цілісний і добре зроблений. Повний цикл «проєкт → модерація → заявка → найм → завдання → здача → доопрацювання → прийняття → відгуки» проходить без збоїв, права доступу перевіряються послідовно, інтерфейс адаптивний і доступний з клавіатури. Публічному запуску заважають чотири конкретні проблеми, і кожна виправляється за години, а не тижні:

1. **BUG-01. Захист від гонок не працює.** `update()` у Prisma 8 не переносить умову в SQL. Два одночасні кліки «Прийняти» створюють два замовлення, і так само ламаються ще ~10 переходів станів.
2. **BUG-02 і BUG-05. Вхід можна перебирати без обмежень.** А ліміт реєстрацій за проксі Render один на весь сайт.
3. **BUG-03. Модерацію можна обійти.** Після схвалення проєкт можна переписати на будь-який текст, і він лишається на біржі.
4. **BUG-04 і BUG-10.** Пошти всіх фрілансерів відкриті будь-якому зареєстрованому користувачу, а витрати на AI нічим не обмежені.

Після кроків 1–6 з [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) (≈ 6–8 годин роботи) продукт можна відкривати для публічного користування з невеликою аудиторією.

## Статистика перевірок

| Показник | Значення |
|---|---|
| Усього перевірок | 291 |
| PASS | 249 |
| FAIL | 31 |
| BLOCKED | 0 |
| NOT TESTED | 11 |
| Частка виконаних | 96% (280 з 291) |
| Знайдено дефектів | 22 (3 High, 9 Medium, 10 Low), без Critical |
| Рівень впевненості у висновку | **Середньо-високий.** Бекенд і права доступу перевірені реальними запитами (≈ 170 перевірок), браузер обійшов усі маршрути трьох ролей. Знижують впевненість: прихована панель браузера (візуальні знімки після вимкнення анімацій), Ада без live-викликів, Lighthouse не запускався. |

Одна FAIL-перевірка може відповідати кільком дефектам і навпаки, тому кількість FAIL-перевірок і кількість дефектів різняться.

## Загальна оцінка

| Аспект | Оцінка | Коротко |
|---|---|---|
| Функціональність | 8/10 | Усі заявлені функції працюють; бізнес-правила (бюджет, дедлайни, переходи станів, відгуки після завершення) дотримуються в послідовних сценаріях |
| Конкурентність і цілісність даних | 4/10 | BUG-01: системна гонка в усіх «умовних» оновленнях |
| Безпека | 6/10 | IDOR не знайдено, валідація сувора, файли перевіряються за сигнатурою. Але немає ліміту на вхід, пошти відкриті, немає заголовків безпеки, 11 вразливостей у залежностях |
| UX/UI | 8/10 | Послідовна дизайн-система, зрозумілі стани, без переповнення на 9 ширинах; дрібні мобільні дефекти |
| Доступність | 7/10 | skip-link, фокус, підписи; 3 serious/critical порушення axe |
| Продуктивність | 6/10 | Відповіді < 1 с, але бандл 709 КБ одним файлом і без кешування; біржа читає всі проєкти на кожен запит |
| Тести | 7/10 | 216 юніт + 7 e2e + 35 web зелені; інтеграційний тест застарів, гонки не покриті |

## Інвентаризація

### Фронтенд: 35 маршрутів

Гість: `/welcome`, `/login`, `/register`. Після входу: `/getting-started`, `/`, `/projects`, `/projects/new`, `/projects/:id` (+ `board`, `plan`, `milestones`, `activity`, `edit`, `tasks/new`, `files`, `applications`, `orders`), `/tasks`, `/tasks/:taskId` (+ `edit`), `/marketplace` (+ `/:id`), `/messages`, `/notifications`, `/profile`, `/workload`, `/ai`, `/complaints`, `/help` (+ `/:articleId`), `/freelancers/:id`, `/clients/:id`. Адмін: `/admin`, `/admin/users`, `/admin/moderation`, `/admin/projects`, `/admin/complaints`. Плюс `*` (404).

### API: 113 маршрутів у 13 контролерах

| Модуль | Маршрути | Перевірено реальними запитами |
|---|---|---|
| auth | 11 | 11 |
| projects (біржа, заявки, відгуки, учасники) | 22 | 19 |
| tasks (завдання, колонки, замовлення) | 12 | 8 |
| collaboration (чати, SSE, файли, здачі) | 19 | 15 |
| milestones | 3 | 1 (через UI) |
| analytics | 5 | 5 (через UI) |
| notifications (+ SSE) | 6 | 3 |
| complaints | 5 | 3 |
| admin | 8 | 7 |
| agent (Ада, MCP) | 7 | 4 (без live-AI) |
| users / avatars / довідники | 14 | 4 |
| health | 1 | 1 |

### База даних: 26 моделей

`User`, `AuthSession`, `Project`, `ProjectApplication`, `ApplicationMessage`, `FreelancerReview`, `ClientReview`, `ProjectMember`, `Task`, `BoardColumn`, `FreelancerProfile`, `Skill`, `FreelancerSkill`, `PortfolioItem`, `ProjectCategory`, `ProjectSkill`, `FavoriteProject`, `ProjectMilestone`, `Notification`, `ActivityLog`, `Complaint`, `Message`, `Order`, `FileAttachment`, `WorkSubmission`, `StoredFile`. Міграції: 21, на чистій базі застосовуються без помилок.

### Матриця «фронтенд → API → сервіс → БД» (ключові потоки)

| Сторінка | API | Сервіс | Таблиці |
|---|---|---|---|
| `/register`, `/login` | `POST /auth/register`, `/auth/login` | `AuthService` | `User`, `AuthSession` |
| `/projects/new`, `/edit` | `POST/PATCH /projects` | `ProjectsService.create/update` | `Project`, `ProjectSkill` |
| `/admin/moderation` | `POST /admin/moderation/projects/:id` | `AdminService.moderate` | `Project`, `ActivityLog` |
| `/marketplace` | `GET /marketplace/projects`, `POST /projects/:id/applications` | `ProjectsService.marketplace/apply` | `Project`, `ProjectApplication`, `FavoriteProject` |
| `/projects/:id/applications` | `POST /applications/:id/accept` | `ProjectsService.acceptApplication` | `ProjectApplication`, `ProjectMember`, `Order` |
| `/projects/:id/board` | `PATCH /tasks/:id/status`, `PUT /projects/:id/columns/order` | `TasksService` | `Task`, `BoardColumn` |
| `/tasks/:taskId` | `POST /tasks/:id/submissions`, `POST /submissions/:id/review` | `CollaborationService` | `WorkSubmission`, `FileAttachment`, `Task` |
| `/projects/:id/files` | `POST /projects/:id/files`, `GET /files/:id/download` | `FilesService` | `FileAttachment`, `StoredFile` |
| `/messages` | `GET/POST …/messages`, SSE `…/messages/stream` | `CollaborationService` | `Message`, `ApplicationMessage` |
| `/ai` | `POST /agent/chat`, `/mcp` | `AgentService`, `McpService` | читає все через сервіси вище |

### Розбіжності інтерфейсу й сервера

- **Скарги.** UI пропонує лише людей зі спільних проєктів, а API приймає скаргу на будь-кого (BUG-15).
- **Ада для адміна.** Сервер реєструє для адміна MCP-інструменти, але в адмінці Ади немає (BUG-21).
- **Модерація.** UI вважає, що схвалений проєкт уже перевірено, а API дозволяє змінити його повністю (BUG-03).
- **README.** Сказано, що інтеграційний тест «відкочує власні тестові записи» і проходить, але зараз він падає (BUG-18).

## Критичні та функціональні проблеми

Повні описи з кроками є в [BUG_REPORT.md](BUG_REPORT.md). Критичних (Critical) дефектів, тобто таких, що дають чужі дані або повний злам, не знайдено: 40+ спроб IDOR, підробки JWT (`alg=none`, змінений `sub`) і підвищення ролі відхилені.

## Архітектура

- **Шари NestJS** (контролер → сервіс → ORM) витримані. `requireAccess`/`requireOwner` в одному місці, тому права доступу послідовні. MCP-інструменти Ади викликають ті самі сервіси від імені користувача, тож Ада не може побачити більше, ніж сам користувач.
- **Системний ризик: семантика `update()` у Prisma 8** (BUG-01). Код повсюди спирається на «умовне оновлення», якого насправді немає. Варто виправити один раз і закріпити правилом лінтера або короткою нотаткою в `docs/IMPLEMENTATION_NOTES.md`.
- **Стан у пам'яті процесу.** SSE-події і ліміти позначені коментарями `shortcut:`. Для одного інстансу на Render це прийнятно, для кількох потрібен Redis.
- **Файли в PostgreSQL** (`StoredFile.content`, ZIP до 50 МБ). На безкоштовній базі 1 ГБ це швидко заповнить місце (див. попередній аудит, пункт 5).
- **Біржа і аналітика** фільтрують у JavaScript після читання всіх рядків. При сотні проєктів це непомітно, при тисячах уже повільно.

## Продуктивність

| Метрика | Значення | Оцінка |
|---|---|---|
| HTML `taskoai.pp.ua` | 0,64 с | добре |
| API `/health` | 0,74 с | добре |
| Головний JS | 709 КБ (204 КБ gzip), один чанк | забагато для першого входу з мобільного |
| CSS | 212 КБ (38 КБ gzip) | прийнятно |
| Кешування `/assets/*` | `max-age=0` | кожен візит знову завантажує 240 КБ |
| SSE-доставка повідомлення | 252 мс | добре |
| Lighthouse / Core Web Vitals | NOT TESTED | потрібне завантаження `lighthouse`, без дозволу не запускав |

## Безпека (OWASP Top 10)

| Категорія | Результат |
|---|---|
| A01 Broken Access Control | ✓ IDOR не знайдено (проєкти, файли, чати, заявки, сеанси, відгуки, адмін-маршрути). ✗ Адмін завантажує приватні файли (BUG-07) |
| A02 Cryptographic Failures | ✓ scrypt для паролів, `timingSafeEqual`, JWT HS256 з фіксованим алгоритмом |
| A03 Injection | ✓ SQL-ін'єкції в пошуку не спрацювали (ORM з параметрами, LIKE-символи екрановано). ✓ Markdown Ади без `dangerouslySetInnerHTML`. ⚠ Prompt injection у ранжуванні (BUG-12) |
| A04 Insecure Design | ✗ Обхід модерації (BUG-03), гонки (BUG-01) |
| A05 Security Misconfiguration | ✗ Немає HSTS/CSP/XFO, `X-Powered-By`, Swagger публічний (BUG-16). ✓ CORS лише для `WEB_ORIGIN` |
| A06 Vulnerable Components | ✗ 11 вразливостей (BUG-11) |
| A07 Identification & Auth Failures | ✗ Немає ліміту входу (BUG-02), повтор коду 2FA (BUG-14). ✓ Сеанси в БД, відкликання, блокування діє одразу, зміна пароля закриває інші сеанси |
| A08 Integrity Failures | ✓ Файли перевіряються за сигнатурою, HTML і підроблений PDF відхиляються, ім'я файлу очищається від `../` |
| A09 Logging & Monitoring | ⚠ 500 на великому тілі запиту засмічує лог (BUG-08) |
| A10 SSRF | ✓ Зовнішні запити йдуть лише на налаштований AI-провайдер і Google |
| Витік даних | ✗ Пошти фрілансерів (BUG-04). ✓ Відповіді не містять хешів, секретів 2FA, `sessionId` |

## Ада (AI)

| Перевірка | Результат |
|---|---|
| Ізоляція даних | ✓ MCP-інструменти тільки читають і викликають ті самі сервіси з правами користувача. Учасник читає чат свого проєкту, клієнт не бачить адмінських інструментів |
| Підтвердження перед збереженням | ✓ `draft_project` нічого не записує, AI-план зберігається лише через `POST …/ai-plan/apply` |
| Поведінка без ключа | ✓ Статус `available=false`, у UI зрозуміле повідомлення «AI-провайдер ще не підключений» |
| Відповіді, галюцінації, порівняння заявок, плани, тайм-аути, prompt injection | NOT TESTED. Live-виклики платні, дозволу на них не було. Ризик prompt injection у ранжуванні видно з коду (BUG-12) |

Помилки AI відокремлено від помилок інтеграції: усі знайдені проблеми Ади стосуються інтеграції (немає ліміту, текст заявки в промпті) або UI (немає Ади в адмінці). Якість відповідей моделі не оцінювалась.

## Тести й збірка

| Команда | Результат |
|---|---|
| `apps/api: npm run typecheck` | ✓ |
| `apps/api: npm run lint` | ✓ (2 попередження) |
| `apps/api: npm test` | ✓ 216/216 |
| `apps/api: npm run test:e2e` | ✓ 7/7 |
| `apps/api: npm run test:integration` | ✗ застарів (BUG-18) |
| `apps/api: npm run db:migrate` | ✓ 21/21 на чистій базі |
| `apps/web: npm test` | ✓ 35/35 |
| `apps/web: npm run typecheck` / `build` | ✓ / ✓ |
| `apps/web/test/*.browser.*` | NOT TESTED: Playwright MCP не підключився |

Чого бракує в тестах: паралельних сценаріїв, ліміту входу, модерації після редагування, приватності профілю. Повний перелік є в [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md#відсутні-тести-додати-разом-з-виправленнями).

## NOT TESTED і як перевірити

| Що | Чому | Як перевірити |
|---|---|---|
| Ада live (5 перевірок) | платні виклики | дозволити `npm run test:ai` на тестовому ключі; додати кейс з ін'єкцією в заявці |
| Вхід через Google | потрібен справжній Client ID і акаунт | на staging з тестовим Google-акаунтом |
| Drag-and-drop на дошці | панель браузера прихована | Playwright з видимим браузером: `dragTo` між колонками |
| Завантаження файлу через UI | те саме | Playwright `setInputFiles` |
| Тайм-аут, offline | не відтворювались окремо | DevTools → Network throttling / Offline |
| Системна тема | `prefers-color-scheme` не перемикався | `page.emulateMedia({ colorScheme })` у Playwright |
| Lighthouse | потрібне завантаження пакета | `npx lighthouse https://taskoai.pp.ua --view` |
| `apps/web/test/*.browser.*` | Playwright MCP не підключився | `npx playwright test` локально |

## Середовище і що лишилося після аудиту

- **Тестові бази.** Локальні бази `taskoai_qa` і `taskoai_qa_empty` у Docker-контейнері `taskoai-postgres` (порт 5434). Робоча база `taskoai` не змінювалась. Видалити бази: `DROP DATABASE taskoai_qa; DROP DATABASE taskoai_qa_empty;`.
- **Production.** Нічого не створювалось і не змінювалось.
- **Код.** Робочий код не змінювався. Додано лише цей каталог `docs/qa-audit/`, а також конфігурації `api-qa`/`web-qa` у локальному `.claude/launch.json`, який не відстежується git.
- **Скрипти.** У `scripts/` лежать HTTP-сценарії (`scenarios.mjs`), реалтайм (`realtime.mjs`), гонки (`race.mjs`), 2FA (`twofa.mjs`). Запуск: API на тестовій базі на `127.0.0.1:3100`, перший аргумент — шлях до `.tmp/demo-accounts.json`.
- `npm run db:migrate` на тестовій базі оновив відстежуваний файл `apps/api/migrations/app/refs/db.json`. Файл повернуто до стану з git. Побічне спостереження: у `main` цей ref вказує на хеш `36103268…`, а остання міграція (`20261113T1556_notification_application`) веде до `b8833235…`, тобто закомічений ref не відповідає останній міграції. Варто перевірити `npm run db:verify` перед наступним деплоєм.
