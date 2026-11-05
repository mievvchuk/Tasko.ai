import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage, request } from "../api";
import { PasswordInput } from "../components/PasswordInput";
import { passwordStrength } from "../format";
import { useLanguage } from "../i18n";

const strengthNames = ["", "Легкий", "Середній", "Складний", "Дуже складний"];

export function RegisterPage() {
  const navigate = useNavigate();
  const { t, tr } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"CLIENT" | "FREELANCER">("CLIENT");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const strength = passwordStrength(password);

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
      await request("/auth/register", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), password, role },
        auth: false,
        timeoutMs: 45000,
      });
      await navigate("/login", {
        replace: true,
        state: { registered: true, email: email.trim() },
      });
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
              <i className="bi bi-briefcase role-icon" aria-hidden="true"></i>
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
              <i className="bi bi-laptop role-icon" aria-hidden="true"></i>
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
          {password ? (
            <div
              className={`password-strength level-${strength}`}
              aria-live="polite"
            >
              <span className="password-strength-bar" aria-hidden="true">
                <i></i>
              </span>
              <span>
                {tr("Складність:")} <strong>{tr(strengthNames[strength])}</strong>
                {password.length < 8 && ` · ${t("passwordHint")}`}
              </span>
            </div>
          ) : (
            <p className="field-hint">{t("passwordHint")}</p>
          )}
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
