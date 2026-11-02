import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { useLanguage } from "../i18n";

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const response = await request<{ message: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: { email: email.trim() },
          auth: false,
        },
      );
      setMessage(response.message);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="forgot-title">
      <span className="card-kicker">{t("recoveryKicker")}</span>
      <h2 id="forgot-title">{t("recoveryTitle")}</h2>
      <p className="card-description">{t("recoveryDescription")}</p>
      <form onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="form-fields">
          <div className="field">
            <label htmlFor="reset-email">{t("email")}</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {message && <div className="notice success">{message}</div>}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full" type="submit">
            {submitting ? t("sending") : t("sendLink")}
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        <Link to="/login">{t("backToLogin")}</Link>
      </p>
    </section>
  );
}
