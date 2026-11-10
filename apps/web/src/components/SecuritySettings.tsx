import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";
import { describeDevice, formatDate } from "../format";
import type { AuthSession, User } from "../types";
import { useApi } from "../useApi";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrength } from "./PasswordStrength";
import { ResourceState } from "./ResourceState";

import { useLanguage } from "../i18n";
export function SecuritySettings({ user }: { user: User }) {
  const { tr } = useLanguage();
  const sessions = useApi<AuthSession[]>("/auth/sessions");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  // Помилка поточного пароля від сервера показується під цим полем
  const [currentError, setCurrentError] = useState("");
  const sameAsCurrent =
    user.hasPassword !== false &&
    newPassword.length > 0 &&
    newPassword === currentPassword;
  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    user.twoFactorEnabled,
  );
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Акаунт із Google без пароля: пароль можна встановити, поточного не питаємо
  const [hasPassword, setHasPassword] = useState(user.hasPassword !== false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sameAsCurrent || newPassword !== confirmation) return;
    setError("");
    setMessage("");
    setCurrentError("");
    setSubmitting(true);
    try {
      const response = await request<{ message: string }>("/auth/password", {
        method: "PATCH",
        body: hasPassword ? { currentPassword, newPassword } : { newPassword },
      });
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage(response.message);
      sessions.refresh();
    } catch (error) {
      const text = errorMessage(error);
      // Неправильний поточний пароль показуємо під його полем
      if (text === tr("Поточний пароль неправильний.")) setCurrentError(text);
      else setError(text);
    } finally {
      setSubmitting(false);
    }
  }

  async function beginTwoFactor() {
    await run(async () => {
      const response = await request<{ secret: string; qrCode: string }>(
        "/auth/2fa/setup",
        { method: "POST" },
      );
      setSetup(response);
    });
  }

  async function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const response = await request<{ message: string }>("/auth/2fa/enable", {
        method: "POST",
        body: { code },
      });
      setTwoFactorEnabled(true);
      setSetup(null);
      setCode("");
      setMessage(response.message);
    });
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const response = await request<{ message: string }>("/auth/2fa/disable", {
        method: "POST",
        body: hasPassword ? { code, password: disablePassword } : { code },
      });
      setTwoFactorEnabled(false);
      setCode("");
      setDisablePassword("");
      setMessage(response.message);
    });
  }

  async function revokeSession(id: string) {
    await run(async () => {
      await request(`/auth/sessions/${id}`, { method: "DELETE" });
      sessions.refresh();
      setMessage(tr("Сеанс завершено."));
    });
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {(message || error) && (
        <div
          className={error ? "notice error" : "notice success"}
          role="status"
        >
          {error || message}
        </div>
      )}
      {/* Одна картка «Безпека» з трьома секціями, розділеними лініями (макет Figma) */}
      <section
        className="account-panel security-card"
        aria-labelledby="security-title"
      >
        <h2 id="security-title">{tr("Безпека")}</h2>
        <div className="security-section">
          <h3>{hasPassword ? tr("Зміна пароля") : tr("Пароль")}</h3>
          <p className="form-note">
            {hasPassword
              ? tr("Після зміни інші активні сеанси завершаться.")
              : tr(
                  "Ви входите через Google. Встановіть пароль, щоб входити ще й поштою.",
                )}
          </p>
          <form onSubmit={changePassword} className="security-form">
            {hasPassword && (
              <PasswordInput
                id="current-password"
                label={tr("Поточний пароль")}
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setCurrentError("");
                }}
                autoComplete="current-password"
                placeholder={tr("Введіть поточний пароль")}
                error={currentError}
              />
            )}
            <PasswordInput
              id="profile-new-password"
              label={tr("Новий пароль")}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              placeholder={tr("Придумайте новий пароль")}
              error={
                sameAsCurrent
                  ? tr("Новий пароль має відрізнятися від поточного.")
                  : ""
              }
            />
            <PasswordStrength password={newPassword} />
            <PasswordInput
              id="profile-new-password-confirmation"
              label={tr("Повторіть новий пароль")}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              error={mismatch ? tr("Нові паролі не збігаються.") : ""}
            />
            <button
              className="button primary"
              disabled={submitting || sameAsCurrent || mismatch}
            >
              {hasPassword ? tr("Змінити пароль") : tr("Встановити пароль")}
            </button>
          </form>
        </div>

        <div className="security-section">
          <div className="security-row">
            <div>
              <h3>{tr("Двофакторний вхід")}</h3>
              <p className="form-note">
                {tr("Статус:")}{" "}
                <strong>
                  {twoFactorEnabled ? tr("Увімкнено") : tr("Вимкнено")}
                </strong>{" "}
                {tr("· код із Google Authenticator або іншого TOTP-застосунку")}
              </p>
            </div>
            {!twoFactorEnabled && !setup && (
              <button
                className="button secondary"
                onClick={beginTwoFactor}
                disabled={submitting}
              >
                {tr("Увімкнути 2FA")}
              </button>
            )}
          </div>
          {setup && (
            <form onSubmit={enableTwoFactor} className="two-factor-setup">
              <img src={setup.qrCode} alt={tr("QR-код для налаштування 2FA")} />
              <div>
                <p>{tr("Відскануйте QR-код або введіть секрет вручну:")}</p>
                <code>{setup.secret}</code>
                <div className="field compact-field">
                  <label htmlFor="enable-2fa-code">
                    {tr("Код із застосунку")}
                  </label>
                  <input
                    id="enable-2fa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                <button className="button primary" disabled={submitting}>
                  {tr("Підтвердити 2FA")}
                </button>
              </div>
            </form>
          )}
          {twoFactorEnabled && (
            <form
              onSubmit={disableTwoFactor}
              className="security-form narrow-form"
            >
              {hasPassword && (
                <PasswordInput
                  id="disable-2fa-password"
                  label={tr("Пароль")}
                  value={disablePassword}
                  onChange={setDisablePassword}
                  autoComplete="current-password"
                />
              )}
              <div className="field">
                <label htmlFor="disable-2fa-code">
                  {tr("Код із застосунку")}
                </label>
                <input
                  id="disable-2fa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>
              <button className="button secondary" disabled={submitting}>
                {tr("Вимкнути 2FA")}
              </button>
            </form>
          )}
        </div>

        <div className="security-section">
          <h3>{tr("Активні сеанси")}</h3>
          <p className="form-note">
            {tr("Пристрої, на яких зараз виконано вхід.")}
          </p>
          <ResourceState
            loading={sessions.loading}
            error={sessions.error}
            onRetry={sessions.refresh}
          />
          {sessions.data && (
            <ul className="session-list">
              {sessions.data.map((session) => (
                <li key={session.id}>
                  <span className="session-icon" aria-hidden="true">
                    <i className="bi bi-laptop"></i>
                  </span>
                  <div>
                    <strong>
                      {session.current
                        ? tr("Поточний сеанс")
                        : tr("Інший пристрій")}
                    </strong>
                    <span title={session.userAgent ?? undefined}>
                      {describeDevice(session.userAgent)}
                    </span>
                    <small>
                      {session.ipAddress || tr("IP невідомий")} ·{" "}
                      {formatDate(session.createdAt, true)}
                    </small>
                  </div>
                  {!session.current && (
                    <button
                      className="button secondary danger-outline"
                      onClick={() => revokeSession(session.id)}
                      disabled={submitting}
                    >
                      {tr("Завершити")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
