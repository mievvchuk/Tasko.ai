import { BrandWord } from "./BrandWord";
import { BrandMark } from "./BrandMark";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { ThemePicker } from "./ThemePicker";
import { AccountMenu } from "./AccountMenu";

// Окремий каркас адмінки за зразком shadcn-admin (MIT, © Sat Naing,
// https://github.com/satnaing/shadcn-admin): бічна панель розділів і верхня панель
// з пошуком, темою та акаунтом. Перенесено лише структуру, стилі — власні (app.css).
export function AdminLayout() {
  const { user } = useAuth();
  const { t, tr } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  if (user?.role !== "ADMIN")
    return (
      <main className="page-content">
        <section className="account-panel">
          <h1>{tr("Доступ заборонено")}</h1>
          <p>{tr("Ця сторінка доступна лише адміністратору.")}</p>
          <Link className="button primary" to="/">
            {tr("На головну")}
          </Link>
        </section>
      </main>
    );

  // Пошук у верхній панелі веде до таблиці користувачів
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "")
      .trim()
      .slice(0, 100);
    navigate(
      value
        ? `/admin/users?${new URLSearchParams({ search: value })}`
        : "/admin/users",
    );
    close();
  }

  const sections = [
    ["/admin", "bi-speedometer2", tr("Огляд")],
    ["/admin/users", "bi-people", tr("Користувачі")],
    ["/admin/moderation", "bi-patch-check", tr("Модерація")],
    ["/admin/projects", "bi-folder", tr("Проєкти")],
    ["/admin/complaints", "bi-flag", tr("Скарги")],
  ];

  return (
    <div className={menuOpen ? "admin-shell menu-open" : "admin-shell"}>
      <a className="skip-link" href="#admin-content">
        {t("skipContent")}
      </a>
      <aside className="admin-sidebar" id="admin-sidebar">
        <Link className="admin-brand" to="/admin" onClick={close}>
          <BrandMark />
          <span>
            <strong>
              <BrandWord />
            </strong>
            <small>{t("administration")}</small>
          </span>
        </Link>
        <nav aria-label={tr("Розділи адмінки")}>
          <span className="admin-nav-title">{tr("Загальне")}</span>
          {sections.map(([to, icon, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"} onClick={close}>
              <i className={`bi ${icon}`} aria-hidden="true"></i>
              {label}
            </NavLink>
          ))}
          <span className="admin-nav-title">{tr("Інше")}</span>
          <NavLink to="/projects" onClick={close}>
            <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
            {tr("Проєкти на сайті")}
          </NavLink>
        </nav>
      </aside>
      {menuOpen && (
        <div className="admin-backdrop" aria-hidden="true" onClick={close} />
      )}
      <div className="admin-main">
        <header className="admin-header">
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label={menuOpen ? t("closeNavigation") : t("openNavigation")}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <i className="bi bi-layout-sidebar" aria-hidden="true"></i>
          </button>
          <form className="admin-search" role="search" onSubmit={search}>
            <i className="bi bi-search" aria-hidden="true"></i>
            <input
              name="q"
              type="search"
              maxLength={100}
              aria-label={tr("Пошук користувача")}
              placeholder={tr("Пошук користувачів…")}
            />
          </form>
          <div className="admin-header-actions">
            <ThemePicker />
            <LanguageButton />
            <AccountMenu />
          </div>
        </header>
        <main className="admin-content" id="admin-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
