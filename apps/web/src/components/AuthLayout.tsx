import { Link, NavLink, Outlet } from "react-router";
import { LanguageButton, useLanguage } from "../i18n";
import { ThemePicker } from "./ThemePicker";

export function AuthLayout() {
  const { t, tr } = useLanguage();
  return (
    <div className="auth-shell">
      <header className="public-header">
        <Link className="brand" to="/login">
          <span className="brand-mark" aria-hidden="true">
            t
          </span>
          Tasko<span className="brand-ai">.ai</span>
        </Link>
        <nav aria-label={t("login")}>
          <NavLink to="/login">{t("login")}</NavLink>
          <NavLink to="/register">{t("register")}</NavLink>
          <LanguageButton />
          <ThemePicker />
        </nav>
      </header>
      <main className="auth-main">
        <div className="auth-intro">
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t("introTitle")}</h1>
          <p>{t("introText")}</p>
          <div className="workflow" aria-label={tr("Робочий процес")}>
            <span>
              <b>01</b> {t("plan")}
            </span>
            <i aria-hidden="true">→</i>
            <span>
              <b>02</b> {t("work")}
            </span>
            <i aria-hidden="true">→</i>
            <span>
              <b>03</b> {t("approve")}
            </span>
          </div>
        </div>
        <Outlet />
      </main>
      <footer className="public-footer">Tasko.ai · {t("footer")}</footer>
    </div>
  );
}
