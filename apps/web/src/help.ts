import { matchPath } from "react-router";
import type { Language } from "./i18n.en";
import type { UserRole } from "./types";

// Довідка (інструкції «як зробити») і база знань (довідкові факти, FAQ).
// Тексти статей двомовні тут, а не в enText: це великі markdown-блоки, а не підписи інтерфейсу.
export type HelpSection = "guide" | "kb";

export interface HelpArticle {
  id: string;
  section: HelpSection;
  icon: string;
  // Для кого стаття; без ролей — для всіх
  roles?: UserRole[];
  // Сторінки, де стаття з'являється в панелі «?» як підказка до поточного екрана
  paths?: string[];
  title: Record<Language, string>;
  body: Record<Language, string>;
}

export const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    section: "guide",
    icon: "bi-flag",
    paths: ["/", "/getting-started"],
    title: { uk: "Перші кроки в Tasko.ai", en: "First steps in Tasko.ai" },
    body: {
      uk: `Tasko.ai поєднує біржу фріланс-проєктів і керування роботою: заявки, канбан-дошку, етапи, чат, файли та AI-помічницю.

**Клієнт**
1. [Створіть проєкт](/projects/new): назва, опис, бюджет, дедлайн і навички.
2. Дочекайтеся заявок і [оберіть виконавця](/help/choose-freelancer).
3. Плануйте завдання на дошці та приймайте роботу.

**Фрілансер**
1. [Заповніть профіль](/profile): навички, ставка, портфоліо.
2. Знайдіть проєкт на [біржі](/marketplace) і подайте заявку.
3. Після вибору виконуйте завдання й здавайте результат на перевірку.

На кожній сторінці праворуч унизу є кнопка **?** з підказками саме для цього екрана.`,
      en: `Tasko.ai combines a freelance marketplace with work management: applications, a kanban board, milestones, chat, files and an AI assistant.

**Client**
1. [Create a project](/projects/new): title, description, budget, deadline and skills.
2. Wait for applications and [choose a freelancer](/help/choose-freelancer).
3. Plan tasks on the board and accept the work.

**Freelancer**
1. [Fill in your profile](/profile): skills, rate, portfolio.
2. Find a project on the [marketplace](/marketplace) and apply.
3. Once selected, complete tasks and submit results for review.

Every page has a **?** button in the bottom-right corner with tips for that screen.`,
    },
  },
  {
    id: "create-project",
    section: "guide",
    icon: "bi-plus-square",
    roles: ["CLIENT"],
    paths: ["/projects", "/projects/new", "/projects/:id/edit"],
    title: { uk: "Як створити проєкт", en: "How to create a project" },
    body: {
      uk: `1. Відкрийте **Мої проєкти** → **Новий проєкт** або перейдіть [сюди](/projects/new).
2. Опишіть задачу так, щоб виконавець зрозумів результат: що треба зробити і як ви його приймете.
3. Вкажіть бюджет і дедлайн — вони видні на біржі й допомагають фрілансерам оцінити роботу.
4. Додайте потрібні навички: за ними фрілансери фільтрують біржу.
5. Збережіть. Новий проєкт має статус **Пошук виконавця** і з'являється на біржі.

Змінити умови можна кнопкою **Редагувати** на сторінці проєкту.

> Порада: попросіть Аду розбити проєкт на етапи й завдання — див. [AI-помічниця](/help/ai).`,
      en: `1. Open **My projects** → **New project** or go [here](/projects/new).
2. Describe the work so a freelancer understands the outcome: what to do and how you will accept it.
3. Set a budget and a deadline — they are shown on the marketplace and help freelancers estimate the work.
4. Add the required skills: freelancers filter the marketplace by them.
5. Save. A new project gets the **Looking for a freelancer** status and appears on the marketplace.

You can change the terms with **Edit** on the project page.

> Tip: ask Ada to split the project into milestones and tasks — see [AI assistant](/help/ai).`,
    },
  },
  {
    id: "choose-freelancer",
    section: "guide",
    icon: "bi-people",
    roles: ["CLIENT"],
    paths: ["/projects/:id/applications", "/freelancers/:id"],
    title: { uk: "Як обрати виконавця", en: "How to choose a freelancer" },
    body: {
      uk: `1. На сторінці проєкту відкрийте **Заявки**.
2. Порівняйте запропонований бюджет, строк, рейтинг і портфоліо. Натисніть на ім'я, щоб відкрити профіль фрілансера.
3. Натисніть **Прийняти** на заявці, яка підходить. Інші заявки можна відхилити.
4. Після вибору проєкт переходить у статус **У процесі**, а виконавцю стають доступні дошка, чат і файли.

Якщо заявок багато, попросіть Аду впорядкувати їх — вона пояснить, чому радить саме цих кандидатів.`,
      en: `1. On the project page, open **Applications**.
2. Compare the proposed budget, timeline, rating and portfolio. Click a name to open the freelancer's profile.
3. Click **Accept** on the application that fits. Other applications can be rejected.
4. After that the project becomes **In progress**, and the freelancer gets access to the board, chat and files.

If there are many applications, ask Ada to rank them — she explains why she recommends each candidate.`,
    },
  },
  {
    id: "find-work",
    section: "guide",
    icon: "bi-search",
    roles: ["FREELANCER"],
    paths: ["/marketplace", "/projects"],
    title: {
      uk: "Як знайти проєкт і подати заявку",
      en: "How to find a project and apply",
    },
    body: {
      uk: `1. Відкрийте **Знайти роботу** ([біржа](/marketplace)). Там лише проєкти, які шукають виконавця.
2. Фільтруйте за навичками та бюджетом, відкрийте картку, щоб прочитати опис.
3. Натисніть **Подати заявку**: запропонуйте бюджет, строк і коротко поясніть, як виконаєте роботу.
4. Стежте за статусом у [сповіщеннях](/notifications): **Очікує рішення**, **Прийнято** або **Відхилено**.

Заповнений [профіль](/profile) з портфоліо помітно підвищує шанси.`,
      en: `1. Open **Find work** (the [marketplace](/marketplace)). It only lists projects looking for a freelancer.
2. Filter by skills and budget, open a card to read the description.
3. Click **Apply**: propose a budget and a timeline and briefly explain how you will do the work.
4. Follow the status in [notifications](/notifications): **Awaiting decision**, **Accepted** or **Rejected**.

A complete [profile](/profile) with a portfolio noticeably improves your chances.`,
    },
  },
  {
    id: "project-page",
    section: "guide",
    icon: "bi-folder2-open",
    paths: ["/projects/:id", "/projects/:id/activity"],
    title: { uk: "Сторінка проєкту", en: "The project page" },
    body: {
      uk: `На сторінці проєкту зібрано все про нього:

- **Огляд** — опис, бюджет, дедлайн, учасники та прогрес.
- **Дошка** — завдання за колонками, див. [Канбан-дошка](/help/board).
- **Етапи** — великі частини роботи з термінами, див. [Етапи](/help/milestones).
- **Файли** — документи проєкту.
- **Активність** — історія змін: хто і що зробив.

Клієнт може редагувати проєкт, призупинити або завершити його.`,
      en: `The project page gathers everything about it:

- **Overview** — description, budget, deadline, members and progress.
- **Board** — tasks in columns, see [Kanban board](/help/board).
- **Milestones** — large chunks of work with dates, see [Milestones](/help/milestones).
- **Files** — project documents.
- **Activity** — the change history: who did what.

The client can edit the project, pause it or complete it.`,
    },
  },
  {
    id: "board",
    section: "guide",
    icon: "bi-kanban",
    paths: [
      "/projects/:id/board",
      "/tasks",
      "/projects/:id/tasks/new",
      "/tasks/:taskId/edit",
    ],
    title: { uk: "Канбан-дошка і завдання", en: "Kanban board and tasks" },
    body: {
      uk: `Дошка показує завдання проєкту за колонками: **До виконання → У процесі → На перевірці → Завершено**.

- **Нове завдання** — назва, опис, виконавець, пріоритет і дедлайн.
- **Перетягніть картку** в іншу колонку, щоб змінити статус.
- Червоні позначки підказують про ризики: прострочено, дедлайн близько або високий пріоритет.
- Сторінка [Завдання](/tasks) показує всі ваші завдання з усіх проєктів, з пошуком і фільтрами.

У колонку **Завершено** завдання потрапляє, коли клієнт прийме здану роботу — див. [Здача роботи](/help/submit-work).`,
      en: `The board shows project tasks in columns: **To do → In progress → In review → Done**.

- **New task** — title, description, assignee, priority and deadline.
- **Drag a card** to another column to change its status.
- Red marks warn about risks: overdue, deadline soon or high priority.
- The [Tasks](/tasks) page lists all your tasks across projects, with search and filters.

A task reaches **Done** when the client accepts the submitted work — see [Submitting work](/help/submit-work).`,
    },
  },
  {
    id: "submit-work",
    section: "guide",
    icon: "bi-send-check",
    paths: ["/tasks/:taskId"],
    title: {
      uk: "Здача і перевірка роботи",
      en: "Submitting and reviewing work",
    },
    body: {
      uk: `**Фрілансер**
1. Відкрийте завдання і в блоці здачі опишіть, що зроблено. Додайте посилання або файл.
2. Надішліть — завдання переходить **На перевірку**, клієнт отримує сповіщення.

**Клієнт**
1. Відкрийте завдання на перевірці й ознайомтеся з результатом.
2. Натисніть **Прийняти**, або **Повернути на доопрацювання** з коментарем, що виправити.

Після прийняття можна залишити відгук — він впливає на рейтинг фрілансера.`,
      en: `**Freelancer**
1. Open the task and describe what was done in the submission block. Add a link or a file.
2. Send it — the task moves to **In review** and the client is notified.

**Client**
1. Open the task in review and check the result.
2. Click **Accept**, or **Return for revision** with a comment on what to fix.

After acceptance you can leave a review — it affects the freelancer's rating.`,
    },
  },
  {
    id: "milestones",
    section: "guide",
    icon: "bi-signpost-split",
    paths: ["/projects/:id/milestones"],
    title: { uk: "Етапи проєкту", en: "Project milestones" },
    body: {
      uk: `Етапи ділять проєкт на великі частини з власними термінами й сумою, наприклад «Дизайн», «Розробка», «Тестування».

1. Клієнт створює етап: назва, дедлайн, сума.
2. Завдання прив'язують до етапу, і його прогрес видно одразу.
3. Етап проходить шлях **Заплановано → У процесі → На перевірці → Завершено**.

Етапи зручно згенерувати автоматично — див. [AI-планування](/help/ai).`,
      en: `Milestones split a project into large parts with their own dates and amount, e.g. "Design", "Development", "Testing".

1. The client creates a milestone: title, deadline, amount.
2. Tasks are linked to a milestone, so its progress is visible at once.
3. A milestone goes **Planned → In progress → In review → Completed**.

Milestones are easy to generate automatically — see [AI planning](/help/ai).`,
    },
  },
  {
    id: "ai",
    section: "guide",
    icon: "bi-stars",
    paths: ["/ai", "/projects/:id/plan"],
    title: {
      uk: "AI-помічниця Ада та AI-планування",
      en: "Ada the AI assistant and AI planning",
    },
    body: {
      uk: `**Ада** відповідає на запитання про ваші проєкти, завдання й дедлайни. Відкрийте її кнопкою в правому нижньому куті або на сторінці [AI-помічниця](/ai). На сторінці проєкту чи завдання вона бачить, про що мова.

Що можна попросити:
- «Які завдання горять цього тижня?»
- «Порівняй заявки на мій проєкт».
- «Розбий проєкт на етапи».

**AI-планування** (сторінка проєкту → **План**) пропонує етапи й завдання за описом проєкту. Перегляньте чернетку, змініть що треба і збережіть — завдання з'являться на дошці.

Ада може помилятися: перевіряйте суми й дати перед збереженням.`,
      en: `**Ada** answers questions about your projects, tasks and deadlines. Open her with the button in the bottom-right corner or on the [AI assistant](/ai) page. On a project or task page she knows what you are looking at.

What you can ask:
- "Which tasks are urgent this week?"
- "Compare the applications for my project."
- "Split the project into milestones."

**AI planning** (project page → **Plan**) suggests milestones and tasks from the project description. Review the draft, adjust it and save — the tasks appear on the board.

Ada can make mistakes: check amounts and dates before saving.`,
    },
  },
  {
    id: "messages-files",
    section: "guide",
    icon: "bi-chat-dots",
    paths: ["/messages", "/projects/:id/files"],
    title: { uk: "Повідомлення і файли", en: "Messages and files" },
    body: {
      uk: `**Повідомлення** — чат учасників проєкту. Оберіть проєкт у списку ліворуч і пишіть; нові повідомлення приходять і в сповіщення.

**Файли** — спільні документи проєкту (сторінка проєкту → **Файли**).
- Формати: PDF, PNG, JPG, DOCX, ZIP або TXT (UTF-8).
- Розмір — до 10 МБ на файл.
- Завантажувати й видаляти можуть учасники проєкту.`,
      en: `**Messages** is the chat of project members. Pick a project in the list on the left and write; new messages also arrive as notifications.

**Files** are shared project documents (project page → **Files**).
- Formats: PDF, PNG, JPG, DOCX, ZIP or TXT (UTF-8).
- Size: up to 10 MB per file.
- Project members can upload and delete them.`,
    },
  },
  {
    id: "notifications-workload",
    section: "guide",
    icon: "bi-bell",
    paths: ["/notifications", "/workload"],
    title: {
      uk: "Сповіщення і завантаженість",
      en: "Notifications and workload",
    },
    body: {
      uk: `**Сповіщення** повідомляють про нові заявки, повідомлення, здачу й перевірку робіт. Число біля дзвіночка — непрочитані. Натисніть на сповіщення, щоб перейти до потрібного місця.

**Завантаженість** показує, скільки завдань у роботі та які дедлайни наближаються. Так видно, чи можна брати нову роботу, чи краще перенести терміни.`,
      en: `**Notifications** tell you about new applications, messages, submissions and reviews. The number next to the bell is the unread count. Click a notification to jump to the right place.

**Workload** shows how many tasks are in progress and which deadlines are coming. It helps decide whether to take new work or move dates.`,
    },
  },
  {
    id: "profile-security",
    section: "guide",
    icon: "bi-shield-lock",
    paths: ["/profile"],
    title: { uk: "Профіль і безпека", en: "Profile and security" },
    body: {
      uk: `У [профілі](/profile) можна змінити ім'я, фото, тему оформлення та мову.

Фрілансер додатково заповнює навички, ставку, доступність і портфоліо — це бачать клієнти при виборі виконавця.

**Двофакторний вхід (2FA)**
1. У блоці безпеки увімкніть двофакторний вхід.
2. Відскануйте QR-код застосунком-автентифікатором (Google Authenticator, Microsoft Authenticator тощо).
3. Введіть шестизначний код для підтвердження.

Далі під час входу, крім пароля, потрібен код із застосунку.`,
      en: `In your [profile](/profile) you can change your name, photo, theme and language.

Freelancers also fill in skills, rate, availability and portfolio — clients see this when choosing a freelancer.

**Two-factor sign-in (2FA)**
1. Turn on two-factor sign-in in the security block.
2. Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, etc.).
3. Enter the six-digit code to confirm.

From then on, signing in needs a code from the app in addition to the password.`,
    },
  },
  {
    id: "complaints",
    section: "guide",
    icon: "bi-flag",
    paths: ["/complaints"],
    title: { uk: "Як подати скаргу", en: "How to file a complaint" },
    body: {
      uk: `Якщо учасник порушує правила або проєкт виглядає шахрайським:

1. Відкрийте [Скарги](/complaints).
2. Оберіть, на кого скарга: людину або проєкт.
3. Опишіть проблему фактами: що сталося і коли.
4. Надішліть. Скарга має статус **Очікує розгляду**, доки її не розгляне адміністратор; потім — **Вирішено** або **Відхилено**.`,
      en: `If a member breaks the rules or a project looks fraudulent:

1. Open [Complaints](/complaints).
2. Choose the target: a person or a project.
3. Describe the problem with facts: what happened and when.
4. Send it. The complaint stays **Awaiting review** until an administrator handles it, then becomes **Resolved** or **Rejected**.`,
    },
  },
  {
    id: "kb-roles",
    section: "kb",
    icon: "bi-person-badge",
    title: { uk: "Ролі на платформі", en: "Roles on the platform" },
    body: {
      uk: `| Роль | Що робить |
|---|---|
| **Клієнт** | Створює проєкти, обирає виконавців, ставить завдання, приймає роботу |
| **Фрілансер** | Шукає проєкти на біржі, подає заявки, виконує й здає завдання |
| **Адміністратор** | Керує користувачами й проєктами, розглядає скарги, бачить статистику |

Роль обирається під час реєстрації.`,
      en: `| Role | What they do |
|---|---|
| **Client** | Creates projects, chooses freelancers, sets tasks, accepts work |
| **Freelancer** | Finds projects on the marketplace, applies, completes and submits tasks |
| **Administrator** | Manages users and projects, reviews complaints, sees statistics |

The role is chosen at registration.`,
    },
  },
  {
    id: "kb-statuses",
    section: "kb",
    icon: "bi-list-check",
    title: { uk: "Статуси: що вони означають", en: "Statuses explained" },
    body: {
      uk: `**Проєкт**

| Статус | Значення |
|---|---|
| Пошук виконавця | Проєкт на біржі, приймає заявки |
| У процесі | Виконавця обрано, триває робота |
| Призупинено | Роботу тимчасово зупинено |
| Завершено | Роботу прийнято |
| Скасовано | Проєкт закрито без результату |

**Завдання**: До виконання → У процесі → На перевірці → Завершено.

**Заявка**: Очікує рішення, Прийнято, Відхилено.

**Здача роботи**: Очікує перевірки, Прийнято, Повернуто на доопрацювання.

**Скарга**: Очікує розгляду, Вирішено, Відхилено.`,
      en: `**Project**

| Status | Meaning |
|---|---|
| Looking for a freelancer | On the marketplace, accepting applications |
| In progress | A freelancer is chosen, work is going on |
| Paused | Work is temporarily stopped |
| Completed | The work is accepted |
| Cancelled | Closed without a result |

**Task**: To do → In progress → In review → Done.

**Application**: Awaiting decision, Accepted, Rejected.

**Submission**: Awaiting review, Accepted, Returned for revision.

**Complaint**: Awaiting review, Resolved, Rejected.`,
    },
  },
  {
    id: "kb-rules",
    section: "kb",
    icon: "bi-journal-text",
    title: { uk: "Правила платформи", en: "Platform rules" },
    body: {
      uk: `- Домовляйтеся про умови в чаті проєкту — так історія залишається на платформі.
- Не публікуйте контакти й персональні дані в описах проєктів.
- Файли — лише робочі матеріали, до 10 МБ.
- Будьте ввічливими; образи й спам — підстава для скарги.
- За порушення адміністратор може заблокувати обліковий запис.`,
      en: `- Agree on terms in the project chat so the history stays on the platform.
- Do not post contacts or personal data in project descriptions.
- Files are for work materials only, up to 10 MB.
- Be polite; insults and spam are grounds for a complaint.
- For violations an administrator may block the account.`,
    },
  },
  {
    id: "kb-faq",
    section: "kb",
    icon: "bi-question-circle",
    title: { uk: "Часті запитання", en: "Frequently asked questions" },
    body: {
      uk: `**Забув пароль — що робити?**
Зверніться до адміністратора платформи: він може допомогти відновити доступ.

**Чи можна змінити роль після реєстрації?**
Ні, роль закріплена за обліковим записом. Для іншої ролі створіть окремий обліковий запис.

**Чому мій проєкт не видно на біржі?**
На біржі лише проєкти зі статусом «Пошук виконавця». Після вибору виконавця проєкт зникає з біржі.

**Як змінити мову чи тему?**
Кнопки мови й теми — у верхній частині бічної панелі.

**Ада відповіла неправильно.**
AI може помилятися. Уточніть запитання або перевірте дані на сторінці проєкту.

**Де шукати відповідь, якої тут немає?**
Запитайте [Аду](/ai) або напишіть учаснику проєкту в [повідомленнях](/messages).`,
      en: `**I forgot my password — what now?**
Contact the platform administrator: they can help restore access.

**Can I change my role after registration?**
No, the role is tied to the account. Create a separate account for another role.

**Why isn't my project on the marketplace?**
Only projects with the "Looking for a freelancer" status are listed. Once a freelancer is chosen, it leaves the marketplace.

**How do I change the language or theme?**
The language and theme buttons are at the top of the side panel.

**Ada gave a wrong answer.**
AI can make mistakes. Rephrase the question or check the data on the project page.

**Where do I find an answer that isn't here?**
Ask [Ada](/ai) or message a project member in [messages](/messages).`,
    },
  },
];

export function articlesFor(role: UserRole) {
  return helpArticles.filter(
    (a) => !a.roles || role === "ADMIN" || a.roles.includes(role),
  );
}

// Статті до поточного екрана: точний збіг шляху за шаблоном react-router
export function articlesForPage(pathname: string, role: UserRole) {
  return articlesFor(role).filter((a) =>
    a.paths?.some((path) => matchPath(path, pathname)),
  );
}

export function searchArticles(
  query: string,
  role: UserRole,
  language: Language,
) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return articlesFor(role).filter((a) => {
    const text = `${a.title[language]} ${a.body[language]}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
