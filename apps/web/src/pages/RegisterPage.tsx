import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { justRegisteredKey, roleChosen } from "./GettingStartedPage";
import { PasswordInput } from "../components/PasswordInput";
import { PasswordStrength } from "../components/PasswordStrength";
import { GoogleSignIn } from "../components/GoogleSignIn";
import { useLanguage } from "../i18n";

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t, tr } = useLanguage();
  // Роль, обрану на головній, не перепитуємо; без неї — один вибір тут
  const [params] = useSearchParams();
  const preset = params.get("role");
  const fromLanding = preset === "CLIENT" || preset === "FREELANCER";
  const [role, setRole] = useState<"CLIENT" | "FREELANCER">(
    preset === "FREELANCER" ? "FREELANCER" : "CLIENT",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
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
      await request("/auth/register", {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
        },
        auth: false,
        timeoutMs: 45000,
      });
      // Одразу входимо: GuestRoute побачить позначку й відкриє вітальну сторінку
      try {
        sessionStorage.setItem(justRegisteredKey, roleChosen);
        if (await login(email.trim(), password)) return;
      } catch {
        // не вдалося увійти автоматично — звичайний вхід нижче
      }
      try {
        sessionStorage.removeItem(justRegisteredKey);
      } catch {
        // сховище недоступне
      }
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
          {!fromLanding && (
            <div
              className="segmented"
              role="group"
              aria-label={tr("Що ви плануєте робити?")}
            >
              <button
                type="button"
                aria-pressed={role === "CLIENT"}
                onClick={() => setRole("CLIENT")}
              >
                <i className="bi bi-briefcase" aria-hidden="true"></i>
                {tr("Шукаю виконавця")}
              </button>
              <button
                type="button"
                aria-pressed={role === "FREELANCER"}
                onClick={() => setRole("FREELANCER")}
              >
                <i className="bi bi-laptop" aria-hidden="true"></i>
                {tr("Шукаю замовлення")}
              </button>
            </div>
          )}
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
          <div className="form-grid">
            <PasswordInput
              id="password"
              label={t("password")}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            >
              <PasswordStrength password={password} />
            </PasswordInput>
            <PasswordInput
              id="confirmation"
              label={t("repeatPassword")}
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
            />
          </div>
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
      <GoogleSignIn mode="signup" role={role} />
      <p className="auth-switch">
        {t("hasAccount")} <Link to="/login">{t("signIn")}</Link>
      </p>
    </section>
  );
}
