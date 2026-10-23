import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { roleNames } from "../types";
import { useApi } from "../useApi";
import type { Notification } from "../types";
import { ThemePicker } from "./ThemePicker";

export function Layout() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const notifications = useApi<{ items: Notification[]; unreadCount: number }>(
    "/notifications?limit=1",
  );
  if (!user) return null;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <aside
        className={menuOpen ? "sidebar open" : "sidebar"}
        id="main-navigation"
      >
        <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            t
          </span>
          Tasko<span className="brand-ai">.ai</span>
        </Link>
        <p className="nav-caption">{t("workspaceCaption")}</p>
        <nav aria-label={t("navigation")}>
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
            {t("main")}
          </NavLink>
          <NavLink to="/projects" onClick={() => setMenuOpen(false)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
            </svg>
            {user.role === "FREELANCER"
              ? t("workProjects")
              : user.role === "ADMIN"
                ? t("projects")
                : t("myProjects")}
          </NavLink>
          {user.role === "FREELANCER" && (
            <NavLink to="/marketplace" onClick={() => setMenuOpen(false)}>
              {t("findWork")}
            </NavLink>
          )}
          <NavLink to="/tasks" onClick={() => setMenuOpen(false)}>
            {t("tasks")}
          </NavLink>
          <NavLink to="/workload" onClick={() => setMenuOpen(false)}>
            {t("workload")}
          </NavLink>
          <NavLink to="/messages" onClick={() => setMenuOpen(false)}>
            {t("messages")}
          </NavLink>
          <NavLink to="/ai" onClick={() => setMenuOpen(false)}>
            {t("agent")}
          </NavLink>
          <NavLink to="/notifications" onClick={() => setMenuOpen(false)}>
            Сповіщення{" "}
            {notifications.data?.unreadCount
              ? `(${notifications.data.unreadCount})`
              : ""}
          </NavLink>
          <NavLink to="/complaints" onClick={() => setMenuOpen(false)}>
            Скарги
          </NavLink>
          {user.role === "ADMIN" && (
            <NavLink to="/admin" onClick={() => setMenuOpen(false)}>
              {t("administration")}
            </NavLink>
          )}
          <NavLink to="/profile" onClick={() => setMenuOpen(false)}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
            </svg>
            {t("profile")}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {language === "uk"
                ? roleNames[user.role]
                : t(
                    user.role === "CLIENT"
                      ? "client"
                      : user.role === "FREELANCER"
                        ? "freelancer"
                        : "admin",
                  )}
            </small>
          </div>
        </div>
        <button type="button" className="logout-button" onClick={logout}>
          {t("logout")} <span aria-hidden="true">↗</span>
        </button>
      </aside>
      {menuOpen && (
        <button
          className="menu-backdrop"
          aria-label={t("closeMenu")}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="app-body">
        <header className="app-header">
          <div className="header-heading">
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
            <span>{t("myWorkspace")}</span>
          </div>
          <div className="header-user">
            <ThemePicker />
            <LanguageButton />
            <span className="status-dot" aria-hidden="true" />
            {language === "uk"
              ? roleNames[user.role]
              : t(
                  user.role === "CLIENT"
                    ? "client"
                    : user.role === "FREELANCER"
                      ? "freelancer"
                      : "admin",
                )}
            <span className="avatar small" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="page-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
