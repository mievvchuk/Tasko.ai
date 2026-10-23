import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../auth";
import { errorMessage } from "../api";
import { PasswordInput } from "../components/PasswordInput";
import { useLanguage } from "../i18n";

export function LoginPage() {
  const { login, notice } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const registration = location.state as {
    registered?: boolean;
    email?: string;
  } | null;
  const [email, setEmail] = useState(registration?.email || "");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const authenticated = await login(
        email.trim(),
        password,
        requiresTwoFactor ? twoFactorCode : undefined,
      );
      if (!authenticated) setRequiresTwoFactor(true);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <span className="card-kicker">{t("welcome")}</span>
      <h2 id="login-title">{t("loginTitle")}</h2>
      <p className="card-description">{t("loginDescription")}</p>
      {registration?.registered && (
        <div className="notice success" role="status">
          {t("registered")}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <form onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="form-fields">
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <PasswordInput
            id="password"
            label={t("password")}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          {requiresTwoFactor && (
            <div className="field">
              <label htmlFor="two-factor-code">{t("twoFactorCode")}</label>
              <input
                id="two-factor-code"
                name="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                value={twoFactorCode}
                onChange={(event) =>
                  setTwoFactorCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder="000000"
              />
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full" type="submit">
            {submitting ? t("loggingIn") : t("signIn")}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        <Link to="/forgot-password">{t("forgotPassword")}</Link>
        <br />
        <Link to="/verify-email">{t("verifyEmailLink")}</Link>
      </p>
      <p className="auth-switch">
        {t("noAccount")} <Link to="/register">{t("createAccount")}</Link>
      </p>
    </section>
  );
}
