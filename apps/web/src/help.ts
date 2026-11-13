import { matchPath } from "react-router";
import type { Language } from "./i18n.en";
import type { UserRole } from "./types";

// Покажчик статей довідки. Самі статті — на окремому сайті (apps/docs, Docusaurus);
// тут лише назви й сторінки застосунку, до яких стаття є підказкою в панелі «?».
export type HelpSection = "guide" | "kb";

// Адреса сайту довідки; англійська версія лежить у /en/
const docsBase = (
  import.meta.env?.VITE_DOCS_URL || "https://tasko-ai-docs.onrender.com"
).replace(/\/$/, "");

// Довідка на іншому домені й не бачить localStorage застосунку, тож тему передаємо
// параметром ?docusaurus-theme=, який Docusaurus читає сам ще до першого малювання
export function docsUrl(language: Language, articleId = "getting-started") {
  const theme = globalThis.document?.documentElement.dataset.theme;
  const query =
    theme === "dark" || theme === "light" ? `?docusaurus-theme=${theme}` : "";
  return `${docsBase}${language === "en" ? "/en" : ""}/${articleId}${query}`;
}

// Тему могли змінити вже після того, як посилання намалювалось, тож оновлюємо її в момент кліку
for (const type of ["click", "auxclick"])
  globalThis.document?.addEventListener(
    type,
    (event) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        !link.href.startsWith(docsBase)
      )
        return;
      const url = new URL(link.href);
      url.searchParams.set(
        "docusaurus-theme",
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      );
      link.href = url.href;
    },
    true,
  );

export interface HelpArticle {
  id: string;
  section: HelpSection;
  icon: string;
  // Для кого стаття; без ролей — для всіх
  roles?: UserRole[];
  // Сторінки, де стаття з'являється в панелі «?» як підказка до поточного екрана
  paths?: string[];
  title: Record<Language, string>;
  // Коротка відповідь у панелі «?»; повна стаття — на сайті довідки
  summary: Record<Language, string>;
}

export const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    section: "guide",
    icon: "bi-flag",
    paths: ["/", "/getting-started"],
    title: { uk: "Перші кроки в Tasko.ai", en: "First steps in Tasko.ai" },
    summary: {
      uk: "Оберіть роль, заповніть профіль, а далі — створіть проєкт (клієнт) або знайдіть роботу на біржі (фрілансер). Головна панель показує все важливе одразу.",
      en: "Pick a role and fill in your profile, then create a project (client) or find work on the marketplace (freelancer). The dashboard shows what matters at a glance.",
    },
  },
  {
    id: "create-project",
    section: "guide",
    icon: "bi-plus-square",
    roles: ["CLIENT"],
    paths: ["/projects", "/projects/new", "/projects/:id/edit"],
    title: { uk: "Як створити проєкт", en: "How to create a project" },
    summary: {
      uk: "Натисніть «Опублікувати проєкт», опишіть задачу, бюджет і строк. Після модерації проєкт з’явиться на біржі, і фрілансери почнуть подавати заявки.",
      en: "Click “Publish project” and describe the work, budget and deadline. After moderation it appears on the marketplace and freelancers start applying.",
    },
  },
  {
    id: "choose-freelancer",
    section: "guide",
    icon: "bi-people",
    roles: ["CLIENT"],
    paths: ["/projects/:id/applications", "/freelancers/:id"],
    title: { uk: "Як обрати виконавця", en: "How to choose a freelancer" },
    summary: {
      uk: "Відкрийте заявки проєкту: порівняйте ціну, строк, рейтинг і відгуки. Ада підкаже найкращих кандидатів, а профіль покаже портфоліо.",
      en: "Open the project's applications and compare price, timing, rating and reviews. Ada ranks the best candidates; the profile shows the portfolio.",
    },
  },
  {
    id: "find-work",
    section: "guide",
    icon: "bi-search",
    roles: ["FREELANCER"],
    paths: ["/marketplace", "/marketplace/:id", "/projects"],
    title: {
      uk: "Як знайти проєкт і подати заявку",
      en: "How to find a project and apply",
    },
    summary: {
      uk: "На біржі відфільтруйте проєкти за навичками й бюджетом, відкрийте потрібний і подайте заявку з ціною, строком і коротким листом.",
      en: "Filter marketplace projects by skills and budget, open one and apply with your price, timing and a short message.",
    },
  },
  {
    id: "project-page",
    section: "guide",
    icon: "bi-folder2-open",
    paths: ["/projects/:id", "/projects/:id/activity"],
    title: { uk: "Сторінка проєкту", en: "The project page" },
    summary: {
      uk: "Тут зібрано опис, команду, прогрес і всі розділи проєкту: дошку, етапи, файли, історію та заявки.",
      en: "Here you find the description, team, progress and every section of the project: board, milestones, files, history and applications.",
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
    summary: {
      uk: "Завдання рухаються колонками «До виконання → У процесі → На перевірці → Завершено». Перетягуйте картки або змінюйте статус у самому завданні.",
      en: "Tasks move through To do → In progress → Review → Done. Drag cards or change the status inside the task.",
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
    summary: {
      uk: "Виконавець прикріплює результат і надсилає на перевірку. Клієнт приймає роботу або повертає її з коментарем.",
      en: "The freelancer attaches the result and sends it for review. The client accepts it or returns it with a comment.",
    },
  },
  {
    id: "milestones",
    section: "guide",
    icon: "bi-signpost-split",
    paths: ["/projects/:id/milestones"],
    title: { uk: "Етапи проєкту", en: "Project milestones" },
    summary: {
      uk: "Етапи ділять проєкт на частини з власними строками. Завдання прив’язуються до етапу, а прогрес етапу рахується автоматично.",
      en: "Milestones split a project into parts with their own deadlines. Tasks link to a milestone, and its progress is counted automatically.",
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
    summary: {
      uk: "Ада відповідає на запитання про ваші проєкти та з опису складає план з етапами й завданнями, який можна змінити перед збереженням.",
      en: "Ada answers questions about your projects and drafts a plan with milestones and tasks from a description, which you can edit before saving.",
    },
  },
  {
    id: "messages-files",
    section: "guide",
    icon: "bi-chat-dots",
    paths: ["/messages", "/projects/:id/files"],
    title: { uk: "Повідомлення і файли", en: "Messages and files" },
    summary: {
      uk: "Листуйтеся в межах проєкту й діліться файлами. Файли можна переглянути просто на сайті або завантажити.",
      en: "Chat within a project and share files. Files can be previewed on the site or downloaded.",
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
    summary: {
      uk: "Сповіщення нагадують про нові заявки, зміни статусів і дедлайни. Завантаженість показує, скільки активних завдань у кожного учасника.",
      en: "Notifications tell you about new applications, status changes and deadlines. Workload shows how many active tasks each member has.",
    },
  },
  {
    id: "profile-security",
    section: "guide",
    icon: "bi-shield-lock",
    paths: ["/profile"],
    title: { uk: "Профіль і безпека", en: "Profile and security" },
    summary: {
      uk: "У профілі змініть ім’я, аватар і пароль, увімкніть двофакторний захист і завершіть чужі сеанси.",
      en: "In your profile change your name, avatar and password, turn on two-factor protection and end other sessions.",
    },
  },
  {
    id: "complaints",
    section: "guide",
    icon: "bi-flag",
    paths: ["/complaints"],
    title: { uk: "Як подати скаргу", en: "How to file a complaint" },
    summary: {
      uk: "Оберіть людину — проєкт підставиться сам. Вкажіть причину й опишіть проблему; адміністратор розгляне скаргу і відповість тут же.",
      en: "Pick a person and the project fills in automatically. Give a reason and describe the problem; an admin reviews it and replies here.",
    },
  },
  {
    id: "kb-roles",
    section: "kb",
    icon: "bi-person-badge",
    title: { uk: "Ролі на платформі", en: "Roles on the platform" },
    summary: {
      uk: "Клієнт публікує проєкти й обирає виконавців, фрілансер виконує завдання, адміністратор модерує проєкти та розглядає скарги.",
      en: "Clients publish projects and choose freelancers, freelancers do the tasks, admins moderate projects and handle complaints.",
    },
  },
  {
    id: "kb-statuses",
    section: "kb",
    icon: "bi-list-check",
    title: { uk: "Статуси: що вони означають", en: "Statuses explained" },
    summary: {
      uk: "Проєкт: чернетка → пошук виконавця → у процесі → завершено. Завдання: до виконання → у процесі → на перевірці → завершено.",
      en: "Project: draft → looking for a freelancer → in progress → completed. Task: to do → in progress → review → done.",
    },
  },
  {
    id: "kb-rules",
    section: "kb",
    icon: "bi-journal-text",
    title: { uk: "Правила платформи", en: "Platform rules" },
    summary: {
      uk: "Спілкуйтеся ввічливо й домовляйтеся в межах платформи. За підтверджену скаргу — попередження, тимчасове обмеження або блокування залежно від порушення й повторів.",
      en: "Be polite and keep agreements on the platform. A confirmed complaint leads to a warning, a temporary restriction or a block depending on the violation and repeats.",
    },
  },
  {
    id: "kb-faq",
    section: "kb",
    icon: "bi-question-circle",
    title: { uk: "Часті запитання", en: "Frequently asked questions" },
    summary: {
      uk: "Відповіді на часті питання про оплату, строки, зміну ролі, відновлення пароля та роботу з Адою.",
      en: "Answers to common questions about payment, deadlines, changing roles, password recovery and working with Ada.",
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
    const text = `${a.title[language]} ${a.summary[language]}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
