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
  const query = theme === "dark" || theme === "light" ? `?docusaurus-theme=${theme}` : "";
  return `${docsBase}${language === "en" ? "/en" : ""}/${articleId}${query}`;
}

// Тему могли змінити вже після того, як посилання намалювалось, тож оновлюємо її в момент кліку
for (const type of ["click", "auxclick"])
  globalThis.document?.addEventListener(
    type,
    (event) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || !link.href.startsWith(docsBase))
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
}

export const helpArticles: HelpArticle[] = [
  {
    id: "getting-started",
    section: "guide",
    icon: "bi-flag",
    paths: ["/", "/getting-started"],
    title: { uk: "Перші кроки в Tasko.ai", en: "First steps in Tasko.ai" },
  },
  {
    id: "create-project",
    section: "guide",
    icon: "bi-plus-square",
    roles: ["CLIENT"],
    paths: ["/projects", "/projects/new", "/projects/:id/edit"],
    title: { uk: "Як створити проєкт", en: "How to create a project" },
  },
  {
    id: "choose-freelancer",
    section: "guide",
    icon: "bi-people",
    roles: ["CLIENT"],
    paths: ["/projects/:id/applications", "/freelancers/:id"],
    title: { uk: "Як обрати виконавця", en: "How to choose a freelancer" },
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
  },
  {
    id: "project-page",
    section: "guide",
    icon: "bi-folder2-open",
    paths: ["/projects/:id", "/projects/:id/activity"],
    title: { uk: "Сторінка проєкту", en: "The project page" },
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
  },
  {
    id: "milestones",
    section: "guide",
    icon: "bi-signpost-split",
    paths: ["/projects/:id/milestones"],
    title: { uk: "Етапи проєкту", en: "Project milestones" },
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
  },
  {
    id: "messages-files",
    section: "guide",
    icon: "bi-chat-dots",
    paths: ["/messages", "/projects/:id/files"],
    title: { uk: "Повідомлення і файли", en: "Messages and files" },
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
  },
  {
    id: "profile-security",
    section: "guide",
    icon: "bi-shield-lock",
    paths: ["/profile"],
    title: { uk: "Профіль і безпека", en: "Profile and security" },
  },
  {
    id: "complaints",
    section: "guide",
    icon: "bi-flag",
    paths: ["/complaints"],
    title: { uk: "Як подати скаргу", en: "How to file a complaint" },
  },
  {
    id: "kb-roles",
    section: "kb",
    icon: "bi-person-badge",
    title: { uk: "Ролі на платформі", en: "Roles on the platform" },
  },
  {
    id: "kb-statuses",
    section: "kb",
    icon: "bi-list-check",
    title: { uk: "Статуси: що вони означають", en: "Statuses explained" },
  },
  {
    id: "kb-rules",
    section: "kb",
    icon: "bi-journal-text",
    title: { uk: "Правила платформи", en: "Platform rules" },
  },
  {
    id: "kb-faq",
    section: "kb",
    icon: "bi-question-circle",
    title: { uk: "Часті запитання", en: "Frequently asked questions" },
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
    const text = a.title[language].toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
