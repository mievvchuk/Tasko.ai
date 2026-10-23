import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";
import { formatDate } from "../format";
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
      <section className="account-panel security-panel">
        <div className="section-heading">
          <div>
            <h2>Зміна пароля</h2>
            <p>Після зміни інші активні сеанси завершаться.</p>
          </div>
        </div>
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
      </section>

      <section className="account-panel security-panel">
        <div className="section-heading">
          <div>
            <h2>Двофакторний вхід</h2>
            <p>Код із Google Authenticator або іншого TOTP-застосунку.</p>
          </div>
          <span className={twoFactorEnabled ? "badge" : "badge muted-badge"}>
            {twoFactorEnabled ? "Увімкнено" : "Вимкнено"}
          </span>
        </div>
        {!twoFactorEnabled && !setup && (
          <button
            className="button secondary"
            onClick={beginTwoFactor}
            disabled={submitting}
          >
            Налаштувати 2FA
          </button>
        )}
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
      </section>

      <section className="account-panel security-panel">
        <div className="section-heading">
          <div>
            <h2>Активні сеанси</h2>
            <p>Пристрої, на яких зараз виконано вхід.</p>
          </div>
        </div>
        <ResourceState
          loading={sessions.loading}
          error={sessions.error}
          onRetry={sessions.refresh}
        />
        {sessions.data && (
          <ul className="session-list">
            {sessions.data.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>
                    {session.current ? "Поточний сеанс" : "Інший пристрій"}
                  </strong>
                  <span>{session.userAgent || "Невідомий браузер"}</span>
                  <small>
                    {session.ipAddress || "IP невідомий"} ·{" "}
                    {formatDate(session.createdAt, true)}
                  </small>
                </div>
                {!session.current && (
                  <button
                    className="button secondary"
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
      </section>
    </>
  );
}
