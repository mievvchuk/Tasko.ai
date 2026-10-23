import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage, request } from "../api";
import { PasswordInput } from "../components/PasswordInput";
import { useLanguage } from "../i18n";

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"CLIENT" | "FREELANCER">("CLIENT");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (name.trim().length < 2) {
      setError(t("nameTooShort"));
      return;
    }
    if (password !== confirmation) {
      setError(t("passwordsMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await request<{
        requiresEmailVerification?: boolean;
        emailSent?: boolean;
      }>("/auth/register", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), password, role },
        auth: false,
        timeoutMs: 45000,
      });
      await navigate(
        result.requiresEmailVerification ? "/verify-email" : "/login",
        {
          replace: true,
          state: {
            registered: true,
            email: email.trim(),
            emailSent: result.emailSent,
          },
        },
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="auth-card register-card"
      aria-labelledby="register-title"
    >
      <span className="card-kicker">{t("registerKicker")}</span>
      <h2 id="register-title">{t("registerTitle")}</h2>
      <p className="card-description">{t("registerDescription")}</p>
      <form onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="form-fields">
          <fieldset className="role-selector">
            <legend>{t("roleQuestion")}</legend>
            <label
              className={
                role === "CLIENT" ? "role-option selected" : "role-option"
              }
            >
              <input
                type="radio"
                name="role"
                value="CLIENT"
                checked={role === "CLIENT"}
                onChange={() => setRole("CLIENT")}
              />
              <span>
                <strong>{t("client")}</strong>
                <small>{t("clientHint")}</small>
              </span>
            </label>
            <label
              className={
                role === "FREELANCER" ? "role-option selected" : "role-option"
              }
            >
              <input
                type="radio"
                name="role"
                value="FREELANCER"
                checked={role === "FREELANCER"}
                onChange={() => setRole("FREELANCER")}
              />
              <span>
                <strong>{t("freelancer")}</strong>
                <small>{t("freelancerHint")}</small>
              </span>
            </label>
          </fieldset>
          <div className="field">
            <label htmlFor="name">{t("name")}</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
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
            autoComplete="new-password"
          />
          <p className="field-hint">{t("passwordHint")}</p>
          <PasswordInput
            id="confirmation"
            label={t("repeatPassword")}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full" type="submit">
            {submitting ? t("creating") : t("createAccountButton")}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        {t("hasAccount")} <Link to="/login">{t("signIn")}</Link>
      </p>
    </section>
  );
}
