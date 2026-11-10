import { BrandWord } from "./BrandWord";
import { BrandMark } from "./BrandMark";
import { useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { useApi } from "../useApi";
import type { Notification } from "../types";
import { ThemePicker } from "./ThemePicker";
import { AiChatProvider } from "../aiChat";
import { AiDrawer } from "./AiDrawer";
import { AccountMenu } from "./AccountMenu";
import { HelpButton } from "./HelpButton";

// На комп'ютері .topbar показано як світлу бічну панель з підписами, на телефоні — як верхню (див. app.css).
// Логіка (ролі, сповіщення, вихід) залишилась такою самою.
// Адміністратор на сайті лише переглядає проєкти (без редагування, листування й файлів)
const adminPages =
  /^\/(projects(\/(?!new$)[^/]+(\/(board|milestones|activity))?)?|tasks(\/[^/]+)?|profile|notifications|help(\/.*)?)\/?$/;

export function Layout() {
  const { user } = useAuth();
  const { t, tr } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const notifications = useApi<{ items: Notification[]; unreadCount: number }>(
    "/notifications?limit=1",
  );
  if (!user) return null;
  const admin = user.role === "ADMIN";
  // Решта сайту адміністратору не потрібна: його робоче місце — адмін-панель
  if (admin && !adminPages.test(pathname))
    return <Navigate to="/admin" replace />;

  const close = () => setMenuOpen(false);
  const unread = notifications.data?.unreadCount ?? 0;
  const projectsLabel = admin
    ? tr("Усі проєкти")
    : user.role === "FREELANCER"
      ? t("workProjects")
      : t("myProjects");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/" onClick={close}>
            <BrandMark />
            <BrandWord />
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? t("closeNavigation") : t("openNavigation")}
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
          <nav
            id="main-navigation"
            aria-label={t("navigation")}
            className={menuOpen ? "topbar-nav open" : "topbar-nav"}
          >
            {!admin && (
              <NavLink to="/" end onClick={close}>
                <i className="bi bi-grid" aria-hidden="true"></i>
                <span className="nav-label">{t("main")}</span>
              </NavLink>
            )}
            <NavLink to="/projects" onClick={close}>
              <i className="bi bi-folder" aria-hidden="true"></i>
              <span className="nav-label">{projectsLabel}</span>
            </NavLink>
            {user.role === "FREELANCER" && (
              <NavLink to="/marketplace" onClick={close}>
                <i className="bi bi-search" aria-hidden="true"></i>
                <span className="nav-label">{t("findWork")}</span>
              </NavLink>
            )}
            {!admin && (
              <>
                <NavLink to="/tasks" onClick={close}>
                  <i className="bi bi-check2-square" aria-hidden="true"></i>
                  <span className="nav-label">{t("tasks")}</span>
                </NavLink>
                <NavLink to="/workload" onClick={close}>
                  <i className="bi bi-bar-chart" aria-hidden="true"></i>
                  <span className="nav-label">{t("workload")}</span>
                </NavLink>
                <NavLink to="/messages" onClick={close}>
                  <i className="bi bi-chat-dots" aria-hidden="true"></i>
                  <span className="nav-label">{t("messages")}</span>
                </NavLink>
              </>
            )}
            <NavLink to="/notifications" onClick={close}>
              <i className="bi bi-bell" aria-hidden="true"></i>
              <span className="nav-label">{tr("Сповіщення")}</span>
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </NavLink>
            {!admin && (
              <NavLink to="/complaints" onClick={close}>
                <i className="bi bi-flag" aria-hidden="true"></i>
                <span className="nav-label">{tr("Скарги")}</span>
              </NavLink>
            )}
            {admin && (
              <NavLink to="/admin" onClick={close}>
                <i className="bi bi-shield-lock" aria-hidden="true"></i>
                <span className="nav-label">{t("administration")}</span>
              </NavLink>
            )}
            <NavLink to="/profile" onClick={close}>
              <i className="bi bi-person" aria-hidden="true"></i>
              <span className="nav-label">{t("profile")}</span>
            </NavLink>
            <NavLink to="/help" onClick={close}>
              <i className="bi bi-question-circle" aria-hidden="true"></i>
              <span className="nav-label">{tr("Довідка")}</span>
            </NavLink>
          </nav>
          <div className="topbar-actions">
            <ThemePicker />
            <LanguageButton />
            <AccountMenu />
          </div>
        </div>
      </header>
      {/* Розмова з AI спільна для сторінки /ai і бічної панелі */}
      <AiChatProvider>
        <main className="page-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <AiDrawer />
      </AiChatProvider>
      <HelpButton />
      {/* Нижня панель для телефону (як у мобільному UI kit); на комп'ютері схована */}
      <nav className="bottom-nav" aria-label={t("navigation")}>
        {!admin && (
          <NavLink to="/" end onClick={close}>
            <i className="bi bi-house" aria-hidden="true"></i>
            {t("main")}
          </NavLink>
        )}
        <NavLink to="/projects" onClick={close}>
          <i className="bi bi-folder" aria-hidden="true"></i>
          {projectsLabel}
        </NavLink>
        {!admin && (
          <NavLink to="/messages" onClick={close}>
            <i className="bi bi-chat-dots" aria-hidden="true"></i>
            {t("messages")}
          </NavLink>
        )}
        <NavLink to="/profile" onClick={close}>
          <i className="bi bi-person" aria-hidden="true"></i>
          {t("profile")}
        </NavLink>
      </nav>
    </div>
  );
}
