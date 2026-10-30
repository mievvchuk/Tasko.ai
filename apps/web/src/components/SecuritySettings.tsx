import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";
import { describeDevice, formatDate } from "../format";
import type { AuthSession, User } from "../types";
import { useApi } from "../useApi";
import { PasswordInput } from "./PasswordInput";
import { ResourceState } from "./ResourceState";

export function SecuritySettings({ user }: { user: User }) {
  const sessions = useApi<AuthSession[]>("/auth/sessions");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
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

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("Нові паролі не збігаються.");
      return;
    }
    await run(async () => {
      const response = await request<{ message: string }>("/auth/password", {
        method: "PATCH",
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setMessage(response.message);
      sessions.refresh();
    });
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
        body: { code, password: disablePassword },
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
      setMessage("Сеанс завершено.");
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
        <h2 id="security-title">Безпека</h2>
        <div className="security-section">
          <h3>Зміна пароля</h3>
          <p className="form-note">
            Після зміни інші активні сеанси завершаться.
          </p>
          <form onSubmit={changePassword} className="security-form">
            <PasswordInput
              id="current-password"
              label="Поточний пароль"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordInput
              id="profile-new-password"
              label="Новий пароль"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              id="profile-new-password-confirmation"
              label="Повторіть новий пароль"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
            <button className="button primary" disabled={submitting}>
              Змінити пароль
            </button>
          </form>
        </div>

        <div className="security-section">
          <div className="security-row">
            <div>
              <h3>Двофакторний вхід</h3>
              <p className="form-note">
                Статус:{" "}
                <strong>{twoFactorEnabled ? "Увімкнено" : "Вимкнено"}</strong> ·
                код із Google Authenticator або іншого TOTP-застосунку
              </p>
            </div>
            {!twoFactorEnabled && !setup && (
              <button
                className="button secondary"
                onClick={beginTwoFactor}
                disabled={submitting}
              >
                Увімкнути 2FA
              </button>
            )}
          </div>
          {setup && (
            <form onSubmit={enableTwoFactor} className="two-factor-setup">
              <img src={setup.qrCode} alt="QR-код для налаштування 2FA" />
              <div>
                <p>Відскануйте QR-код або введіть секрет вручну:</p>
                <code>{setup.secret}</code>
                <div className="field compact-field">
                  <label htmlFor="enable-2fa-code">Код із застосунку</label>
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
                  Підтвердити 2FA
                </button>
              </div>
            </form>
          )}
          {twoFactorEnabled && (
            <form
              onSubmit={disableTwoFactor}
              className="security-form narrow-form"
            >
              <PasswordInput
                id="disable-2fa-password"
                label="Пароль"
                value={disablePassword}
                onChange={setDisablePassword}
                autoComplete="current-password"
              />
              <div className="field">
                <label htmlFor="disable-2fa-code">Код із застосунку</label>
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
                Вимкнути 2FA
              </button>
            </form>
          )}
        </div>

        <div className="security-section">
          <h3>Активні сеанси</h3>
          <p className="form-note">Пристрої, на яких зараз виконано вхід.</p>
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
                      {session.current ? "Поточний сеанс" : "Інший пристрій"}
                    </strong>
                    <span title={session.userAgent ?? undefined}>
                      {describeDevice(session.userAgent)}
                    </span>
                    <small>
                      {session.ipAddress || "IP невідомий"} ·{" "}
                      {formatDate(session.createdAt, true)}
                    </small>
                  </div>
                  {!session.current && (
                    <button
                      className="button secondary danger-outline"
                      onClick={() => revokeSession(session.id)}
                      disabled={submitting}
                    >
                      Завершити
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
