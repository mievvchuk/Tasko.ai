<p align="center"><img src="apps/web/public/favicon.svg" width="90" alt="Tasko.ai logo"></p>

<h1 align="center">Tasko.ai</h1>

<p align="center">A freelance marketplace and project management workspace with an AI assistant.</p>

<p align="center"><a href="README.md">🇺🇦 Українська</a> · <strong>🇬🇧 English</strong> · <a href="https://taskoai.pp.ua">Open Tasko.ai</a></p>

<p align="center">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
<img alt="React" src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react">
<img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white">
<img alt="NestJS" src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs">
<img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white">
<img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma">
</p>

Tasko.ai is a course project that brings clients and freelancers together, from publishing a project and selecting an applicant to managing tasks and accepting finished work.

## Features

- **Marketplace:** project categories, budgets, search and filters, favorites, applications, and freelancer selection.
- **Freelancer profiles:** skills, portfolio, ratings, experience, and reviews.
- **Project management:** team members, tasks, a Kanban board with custom columns, milestones, deadlines, orders, and activity history.
- **Collaboration:** messages, file sharing, work submissions, revision requests, and approvals.
- **AI assistant Ada:** answers questions using data accessible to the user, helps draft a project through conversation, compares applications, and generates editable project plans.
- **Analytics:** progress, deadlines, and team workload.
- **Security and administration:** JWT, session management, password change, TOTP 2FA, moderation, and report exports.
- **Interface:** Ukrainian and English, light and dark themes, and responsive layouts.

> Milestone payment statuses are for tracking only; Tasko.ai does not transfer money.

## How it works

```mermaid
flowchart LR
  A[Client publishes a project] --> B[Freelancer applies]
  B --> C[Client selects a freelancer]
  C --> D[Team manages tasks]
  D --> E[Freelancer submits work]
  E --> F[Client reviews and accepts]
  F --> G[Project completion and review]
```

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | NestJS, TypeScript, REST API, Swagger |
| Database | PostgreSQL, Prisma |
| AI | OpenAI-compatible API, Model Context Protocol (MCP) |
| Testing | Vitest, Node.js test runner, HTTP integration tests |

## Getting started

### Requirements

- Node.js **22.22 or newer** and npm
- PostgreSQL **15 or newer**
- Git

### 1. Clone and configure

```bash
git clone https://github.com/mievvchuk/Tasko.ai.git
cd Tasko.ai
```

Create a root `.env` file based on [`.env.example`](.env.example), with at least:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tasko
JWT_SECRET=your-long-random-secret
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

Replace the example database address and secret with your own values. Create the database first and give the PostgreSQL user permission to create tables. Do not commit `.env`.

### 2. Start the API

```bash
cd apps/api
npm ci --ignore-scripts
npm run db:migrate
npm run db:verify
npm run start:dev
```

The default API address is **http://localhost:3000**:

- Swagger: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs-json
- Health check: http://localhost:3000/health

For a production build, run `npm run build` and then `npm run start:prod`.

### 3. Start the web app

Open another terminal at the repository root:

```bash
cd apps/web
npm ci --ignore-scripts
npm run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to `http://localhost:3000` by default. See [`apps/web/.env.example`](apps/web/.env.example) for `API_PROXY_TARGET` and the public `VITE_API_URL`.

On Windows, if PowerShell blocks `npm.ps1`, use `npm.cmd` in place of `npm`.

## Roles and demo

| Role | Capabilities |
| --- | --- |
| Client | Publish projects, select freelancers, create tasks, and accept work |
| Freelancer | Find projects, apply, complete tasks, and submit results |
| Administrator | Manage users, review reports, and export reports |

Register a client and a freelancer, create a project, submit an application, and select the freelancer. The team can then manage tasks, submit work for review, and complete the project. Use separate tabs or browsers for simultaneous sessions.

To create the first administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the root `.env`, then run `npm run admin:create` in `apps/api`. Remove the password from the file afterwards.

For local demo data, run `npm run seed:demo` from `apps/api`. Login addresses and the generated password are saved in the Git-ignored `.tmp/demo-accounts.json`. Repeated runs skip existing demo records.

## AI configuration

Set these values in the root `.env`:

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=your-model
```

Use an HTTPS OpenAI-compatible provider and a model that supports tool calls. Restart the API after changing configuration. AI features require a configured provider.

The assistant uses MCP tools to access project, task, deadline, and workload data available to the current user. No separate MCP server is required. Generated project plans are editable drafts; milestones and tasks are saved only after confirmation.

## Email

Registration does not require email verification, and the service sends no email, so no SMTP setup is needed.

## Checks

From `apps/api`:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:integration
npm run db:verify
```

The integration test requires PostgreSQL and rolls back its own test records. `npm run test:ai` additionally contacts the configured AI provider and uses its quota.

From `apps/web`:

```bash
npm test
npm run typecheck
npm run build
```

## Project structure

```text
apps/
  api/
    src/             NestJS modules and Prisma schema
    migrations/      database migrations
    test/            HTTP and integration tests
  web/
    src/             React application
    test/            tests and browser scenarios
docs/
  diagrams/          UML and architecture diagrams
  IMPLEMENTATION_NOTES.md
.env.example         example configuration
```

See the [implementation notes](docs/IMPLEMENTATION_NOTES.md) for technical details and test history, and the [diagram documentation](docs/diagrams/README.md) for architecture diagrams. The running API exposes the complete endpoint reference in Swagger.
