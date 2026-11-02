# Backend Tasko.ai

NestJS API. Повна інструкція й сценарій Swagger — у [кореневому README](../../README.md).

- npm ci --ignore-scripts — залежності.
- npm run db:migrate — міграції.
- npm run db:verify — відповідність БД контракту.
- npm run start:dev — розробка.
- npm run build та npm run start:prod — збірка й запуск.
- npm run admin:create — адміністратор із ADMIN_* у локальному .env.
- npm run typecheck, npm run lint, npm test — статичні та модульні перевірки.
- npm run test:e2e — HTTP авторизація.
- npm run test:integration — реальна PostgreSQL з відкотом тестових записів.
- npm run test:ai — та сама перевірка з живим AI через MCP; потрібен ключ і доступна модель, витрачається квота провайдера.

Конфігурація — .env у поточному каталозі або корені. Обов'язкові DATABASE_URL та JWT_SECRET (32+ символи). Swagger: http://localhost:3000/docs, порт задає PORT.

Для поточного локального середовища спочатку запустіть Docker Desktop і `docker start taskoai-postgres`. Порт БД — 5434. На Windows за потреби використовуйте `npm.cmd`.

Актуальна схема: src/prisma/contract.prisma. Після зміни виконайте npm run contract:emit та створіть нову міграцію через Prisma CLI.

