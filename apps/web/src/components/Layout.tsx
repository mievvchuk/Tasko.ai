import { BrandWord } from "./BrandWord";
import { BrandMark } from "./BrandMark";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth";
import { LanguageButton, useLanguage } from "../i18n";
import { useApi } from "../useApi";
import { notificationsChangedEvent, subscribe } from "../api";
import { docsUrl } from "../help";
import type { Notification } from "../types";
import { ThemePicker } from "./ThemePicker";
import { AiChatProvider } from "../aiChat";
import { AiDrawer } from "./AiDrawer";
import { AccountMenu } from "./AccountMenu";
import { HelpButton, openHelpEvent } from "./HelpButton";

// На комп'ютері .topbar показано як світлу бічну панель з підписами, на телефоні — як верхню (див. app.css).
// Логіка (ролі, сповіщення, вихід) залишилась такою самою.
// Адміністратор на сайті лише переглядає проєкти (без редагування, листування й файлів)
const adminPages =
  /^\/(projects(\/(?!new$)[^/]+(\/(board|milestones|activity))?)?|tasks(\/[^/]+)?|profile|notifications|help(\/.*)?)\/?$/;

// Ці пункти на телефоні вже є в нижній панелі, тож у меню «Ще» їх не дублюємо
const inBottomNav = ({ isActive }: { isActive: boolean }) =>
  isActive ? "active in-bottom-nav" : "in-bottom-nav";

export function Layout() {
  const { user } = useAuth();
  const { t, tr, language } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname, search } = useLocation();
  const notifications = useApi<{
    items: Notification[];
    unreadCount: number;
    unreadMessages: number;
  }>("/notifications?limit=1");
  const { refresh } = notifications;
  useEffect(() => {
    window.addEventListener(notificationsChangedEvent, refresh);
    return () => window.removeEventListener(notificationsChangedEvent, refresh);
  }, [refresh]);
  // Нове сповіщення чи повідомлення — лічильники оновлюються одразу, без перезавантаження сторінки
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void subscribe(
      "/notifications/stream",
      (type) => {
        if (type === "changed")
          window.dispatchEvent(new Event(notificationsChangedEvent));
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [user?.id]);
  // Під час оновлення показуємо попередні числа, щоб значок не блимав
  const counts = useRef({ unreadCount: 0, unreadMessages: 0 });
  if (notifications.data) counts.current = notifications.data;
  if (!user) return null;
  const admin = user.role === "ADMIN";
  // Решта сайту адміністратору не потрібна: його робоче місце — адмін-панель
  // Посилання на Аду (напр. «Аналіз AI» проєкту) ведуть адміна на її сторінку в адмінці
  if (admin && !adminPages.test(pathname))
    return (
      <Navigate to={pathname === "/ai" ? `/admin/ai${search}` : "/admin"} replace />
    );

  const close = () => setMenuOpen(false);
  const unreadMessages = counts.current.unreadMessages;
  const unread = counts.current.unreadCount - unreadMessages;
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
              <NavLink to="/" end onClick={close} className={inBottomNav}>
                <i className="bi bi-grid" aria-hidden="true"></i>
                <span className="nav-label">{t("main")}</span>
              </NavLink>
            )}
            <NavLink to="/projects" onClick={close} className={inBottomNav}>
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
                  <span className="nav-label">
                    {user.role === "FREELANCER"
                      ? tr("Графік роботи")
                      : t("workload")}
                  </span>
                </NavLink>
                <NavLink to="/messages" onClick={close} className={inBottomNav}>
                  <i className="bi bi-chat-dots" aria-hidden="true"></i>
                  <span className="nav-label">{t("messages")}</span>
                  {unreadMessages > 0 && (
                    <span className="badge-count">{unreadMessages}</span>
                  )}
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
            <NavLink to="/profile" onClick={close} className={inBottomNav}>
              <i className="bi bi-person" aria-hidden="true"></i>
              <span className="nav-label">{t("profile")}</span>
            </NavLink>
            {/* На телефоні плаваючого «?» немає: підказки до сторінки відкриваються з меню «Ще» */}
            <button
              type="button"
              className="nav-help-tips"
              onClick={() => {
                close();
                window.dispatchEvent(new Event(openHelpEvent));
              }}
            >
              <i className="bi bi-lightbulb" aria-hidden="true"></i>
              <span className="nav-label">{tr("Підказки до сторінки")}</span>
            </button>
            <a
              href={docsUrl(language)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              <i className="bi bi-question-circle" aria-hidden="true"></i>
              <span className="nav-label">{tr("Довідка")}</span>
            </a>
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
          {user.restrictedUntil && (
            <p className="notice error restriction-notice" role="status">
              <i className="bi bi-slash-circle" aria-hidden="true"></i>
              <span>
                <strong>
                  {tr(
                    "Акаунт обмежено до {0}.",
                    new Date(user.restrictedUntil).toLocaleDateString(),
                  )}
                </strong>{" "}
                {tr(
                  "До кінця строку не можна публікувати проєкти, подавати заявки й писати повідомлення.",
                )}
                {user.restrictionReason &&
                  ` ${tr("Причина: {0}", user.restrictionReason)}`}
              </span>
            </p>
          )}
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
          {/* Короткі підписи: п'ять пунктів у ряд на вузькому екрані */}
          {admin ? projectsLabel : tr("Проєкти")}
        </NavLink>
        {!admin && (
          <NavLink to="/messages" onClick={close}>
            <i className="bi bi-chat-dots" aria-hidden="true"></i>
            {tr("Чати")}
          </NavLink>
        )}
        <NavLink to="/profile" onClick={close}>
          <i className="bi bi-person" aria-hidden="true"></i>
          {t("profile")}
        </NavLink>
        <button
          type="button"
          className={menuOpen ? "active" : undefined}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <i className="bi bi-three-dots" aria-hidden="true"></i>
          {tr("Ще")}
          {/* Нові сповіщення лежать у «Ще» — крапка підказує туди заглянути */}
          {unread > 0 && !menuOpen && (
            <span className="badge-dot" aria-hidden="true" />
          )}
        </button>
      </nav>
      {menuOpen && (
        <div className="more-backdrop" aria-hidden="true" onClick={close} />
      )}
    </div>
  );
}
