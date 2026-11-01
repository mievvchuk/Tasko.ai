import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { roleNames } from "../types";
import { UserAvatar } from "./UserAvatar";

// Кнопка з аватаром і меню облікового запису; спільна для робочого простору й адмінки.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  if (!user) return null;

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

  return (
    <div
      className="account-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="account-button"
        aria-label={t("accountMenu")}
        aria-expanded={open}
        aria-controls="account-dropdown"
        onClick={() => setOpen(!open)}
      >
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="small" />
        <span className="account-name">{user.name}</span>
        <i className="bi bi-chevron-down" aria-hidden="true"></i>
      </button>
      {open && (
        <>
          {/* Прозора підкладка на весь екран: клік поза меню закриває його */}
          <div
            className="account-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="account-dropdown" id="account-dropdown">
            <div className="account-info">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
              <small>{roleLabel}</small>
            </div>
            <Link to="/profile" onClick={() => setOpen(false)}>
              <i className="bi bi-person" aria-hidden="true"></i>
              {t("myProfile")}
            </Link>
            <button type="button" className="account-logout" onClick={logout}>
              <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
              {t("logout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
