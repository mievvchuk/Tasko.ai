import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { roleNames } from "../types";
import { useApi } from "../useApi";
import type { Notification } from "../types";
import { ThemePicker } from "./ThemePicker";
import { AiChatProvider } from "../aiChat";
import { AiDrawer } from "./AiDrawer";
import { UserAvatar } from "./UserAvatar";

// Редизайн: на комп'ютері .topbar показано як темну бічну панель, на телефоні — як верхню (див. redesign.css).
// Логіка (ролі, сповіщення, вихід) залишилась такою самою.
export function Layout() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  // Відкрите чи закрите меню облікового запису (клік по аватару)
  const [accountOpen, setAccountOpen] = useState(false);
  const notifications = useApi<{ items: Notification[]; unreadCount: number }>(
    "/notifications?limit=1",
  );
  if (!user) return null;

  const close = () => {
    setMenuOpen(false);
    setAccountOpen(false);
  };
  const roleLabel =
    language === "uk"
      ? roleNames[user.role]
      : t(
          user.role === "CLIENT"
            ? "client"
            : user.role === "FREELANCER"
              ? "freelancer"
              : "admin",
        );
  const unread = notifications.data?.unreadCount ?? 0;
  const projectsLabel =
    user.role === "FREELANCER"
      ? t("workProjects")
      : user.role === "ADMIN"
        ? t("projects")
        : t("myProjects");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/" onClick={close}>
            <span className="brand-mark" aria-hidden="true">
              t
            </span>
            Tasko<span className="brand-ai">.ai</span>
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
            {/* На комп'ютері підпис .nav-label розгортається при наведенні (див. redesign.css) */}
            <NavLink to="/" end onClick={close}>
              <i className="bi bi-grid" aria-hidden="true"></i>
              <span className="nav-label">{t("main")}</span>
            </NavLink>
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
            <NavLink to="/notifications" onClick={close}>
              <i className="bi bi-bell" aria-hidden="true"></i>
              <span className="nav-label">Сповіщення</span>
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </NavLink>
            <NavLink to="/complaints" onClick={close}>
              <i className="bi bi-flag" aria-hidden="true"></i>
              <span className="nav-label">Скарги</span>
            </NavLink>
            {user.role === "ADMIN" && (
              <NavLink to="/admin" onClick={close}>
                <i className="bi bi-shield-lock" aria-hidden="true"></i>
                <span className="nav-label">{t("administration")}</span>
              </NavLink>
            )}
            <NavLink to="/profile" onClick={close}>
              <i className="bi bi-person" aria-hidden="true"></i>
              <span className="nav-label">{t("profile")}</span>
            </NavLink>
          </nav>
          <div className="topbar-actions">
            <ThemePicker />
            <LanguageButton />
            <div
              className="account-menu"
              onKeyDown={(event) => {
                if (event.key === "Escape") setAccountOpen(false);
              }}
            >
              <button
                type="button"
                className="account-button"
                aria-label={t("accountMenu")}
                aria-expanded={accountOpen}
                aria-controls="account-dropdown"
                onClick={() => setAccountOpen(!accountOpen)}
              >
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  size="small"
                />
                <span className="account-name">{user.name}</span>
                <i className="bi bi-chevron-down" aria-hidden="true"></i>
              </button>
              {accountOpen && (
                <>
                  {/* Прозора підкладка на весь екран: клік поза меню закриває його */}
                  <div
                    className="account-backdrop"
                    aria-hidden="true"
                    onClick={() => setAccountOpen(false)}
                  />
                  <div className="account-dropdown" id="account-dropdown">
                    <div className="account-info">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                      <small>{roleLabel}</small>
                    </div>
                    <Link to="/profile" onClick={close}>
                      <i className="bi bi-person" aria-hidden="true"></i>
                      {t("myProfile")}
                    </Link>
                    <button
                      type="button"
                      className="account-logout"
                      onClick={logout}
                    >
                      <i
                        className="bi bi-box-arrow-right"
                        aria-hidden="true"
                      ></i>
                      {t("logout")}
                    </button>
                  </div>
                </>
              )}
            </div>
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
      {/* Нижня панель для телефону (як у мобільному UI kit); на комп'ютері схована */}
      <nav className="bottom-nav" aria-label={t("navigation")}>
        <NavLink to="/" end onClick={close}>
          <i className="bi bi-house" aria-hidden="true"></i>
          {t("main")}
        </NavLink>
        <NavLink to="/projects" onClick={close}>
          <i className="bi bi-folder" aria-hidden="true"></i>
          {projectsLabel}
        </NavLink>
        <NavLink to="/messages" onClick={close}>
          <i className="bi bi-chat-dots" aria-hidden="true"></i>
          {t("messages")}
        </NavLink>
        <NavLink to="/profile" onClick={close}>
          <i className="bi bi-person" aria-hidden="true"></i>
          {t("profile")}
        </NavLink>
      </nav>
    </div>
  );
}
