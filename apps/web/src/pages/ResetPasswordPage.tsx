import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { PasswordInput } from "../components/PasswordInput";
import { useLanguage } from "../i18n";

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError(t("missingResetToken"));
      return;
    }
    if (password !== confirmation) {
      setError(t("passwordsMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await request<{ message: string }>(
        "/auth/reset-password",
        {
          method: "POST",
          body: { token, newPassword: password },
          auth: false,
        },
      );
      setMessage(response.message);
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="reset-title">
      <span className="card-kicker">{t("newPasswordKicker")}</span>
      <h2 id="reset-title">{t("newPasswordTitle")}</h2>
      <form onSubmit={submit} aria-busy={submitting}>
        <fieldset
          disabled={submitting || Boolean(message)}
          className="form-fields"
        >
          <PasswordInput
            id="new-password"
            label={t("newPassword")}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            id="new-password-confirmation"
            label={t("repeatNewPassword")}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          {message && <div className="notice success">{message}</div>}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {!message && (
            <button className="button primary full" type="submit">
              {submitting ? t("saving") : t("changePassword")}
            </button>
          )}
        </fieldset>
      </form>
      <p className="auth-switch">
        <Link to="/login">{t("goToLogin")}</Link>
      </p>
    </section>
  );
}
