import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { roleNames } from "../types";
import { useApi } from "../useApi";
import type { Notification } from "../types";
import { ThemePicker } from "./ThemePicker";

// Редизайн: бічне меню замінено на верхню панель (.topbar).
// Логіка (ролі, сповіщення, вихід) залишилась такою самою.
export function Layout() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const notifications = useApi<{ items: Notification[]; unreadCount: number }>(
    "/notifications?limit=1",
  );
  if (!user) return null;

  const close = () => setMenuOpen(false);
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
            {/* На середніх екранах підпис .nav-label ховається (див. redesign.css),
                тому title показує назву пункту при наведенні мишкою. */}
            <NavLink to="/" end onClick={close} title={t("main")}>
              <i className="bi bi-grid" aria-hidden="true"></i>
              <span className="nav-label">{t("main")}</span>
            </NavLink>
            <NavLink to="/projects" onClick={close} title={projectsLabel}>
              <i className="bi bi-folder" aria-hidden="true"></i>
              <span className="nav-label">{projectsLabel}</span>
            </NavLink>
            {user.role === "FREELANCER" && (
              <NavLink to="/marketplace" onClick={close} title={t("findWork")}>
                <i className="bi bi-search" aria-hidden="true"></i>
                <span className="nav-label">{t("findWork")}</span>
              </NavLink>
            )}
            <NavLink to="/tasks" onClick={close} title={t("tasks")}>
              <i className="bi bi-check2-square" aria-hidden="true"></i>
              <span className="nav-label">{t("tasks")}</span>
            </NavLink>
            <NavLink to="/workload" onClick={close} title={t("workload")}>
              <i className="bi bi-bar-chart" aria-hidden="true"></i>
              <span className="nav-label">{t("workload")}</span>
            </NavLink>
            <NavLink to="/messages" onClick={close} title={t("messages")}>
              <i className="bi bi-chat-dots" aria-hidden="true"></i>
              <span className="nav-label">{t("messages")}</span>
            </NavLink>
            <NavLink to="/ai" onClick={close} title={t("agent")}>
              <i className="bi bi-stars" aria-hidden="true"></i>
              <span className="nav-label">{t("agent")}</span>
            </NavLink>
            <NavLink to="/notifications" onClick={close} title="Сповіщення">
              <i className="bi bi-bell" aria-hidden="true"></i>
              <span className="nav-label">Сповіщення</span>
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </NavLink>
            <NavLink to="/complaints" onClick={close} title="Скарги">
              <i className="bi bi-flag" aria-hidden="true"></i>
              <span className="nav-label">Скарги</span>
            </NavLink>
            {user.role === "ADMIN" && (
              <NavLink to="/admin" onClick={close} title={t("administration")}>
                <i className="bi bi-shield-lock" aria-hidden="true"></i>
                <span className="nav-label">{t("administration")}</span>
              </NavLink>
            )}
            <NavLink to="/profile" onClick={close} title={t("profile")}>
              <i className="bi bi-person" aria-hidden="true"></i>
              <span className="nav-label">{t("profile")}</span>
            </NavLink>
          </nav>
          <div className="topbar-actions">
            <ThemePicker />
            <LanguageButton />
            <span className="role-label">{roleLabel}</span>
            <Link to="/profile" title={user.name} onClick={close}>
              <span className="avatar small" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </Link>
            <button
              type="button"
              className="topbar-logout"
              onClick={logout}
              title={t("logout")}
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
              <span className="nav-label">{t("logout")}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="page-content" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
