import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { useLanguage } from "../i18n";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { language } = useLanguage();
  const uk = language === "uk";
  // Keep the token in memory and remove it from the address bar and referrers.
  const [token] = useState(() => params.get("token") || "");
  const registration = location.state as {
    email?: string;
    emailSent?: boolean;
  } | null;
  const [email, setEmail] = useState(registration?.email || "");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (token)
      window.history.replaceState(window.history.state, "", location.pathname);
  }, [token, location.pathname]);
  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ message: string }>("/auth/verify-email", {
        method: "POST",
        auth: false,
        body: { token },
      });
      setMessage(result.message);
      setVerified(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || remaining) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<{ message: string }>(
        "/auth/resend-verification",
        {
          method: "POST",
          auth: false,
          timeoutMs: 45000,
          body: { email: email.trim() },
        },
      );
      setMessage(result.message);
      setCooldownUntil(Date.now() + 60000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-card" aria-labelledby="verify-title">
      <span className="card-kicker">TASKO.AI</span>
      <h2 id="verify-title">
        {uk ? "Підтвердження пошти" : "Verify your email"}
      </h2>
      {!verified && (
        <p className="card-description">
          {token
            ? uk
              ? "Натисніть кнопку, щоб підтвердити, що ця пошта належить вам."
              : "Confirm that this email address belongs to you."
            : uk
              ? "Відкрийте лист Tasko.ai та перейдіть за посиланням. Воно діє 24 години. Перевірте також папку «Спам»."
              : "Open the Tasko.ai email and follow the link within 24 hours. Check your spam folder too."}
        </p>
      )}
      {registration?.emailSent === false && !message && (
        <p className="notice error" role="alert">
          {uk
            ? "Акаунт створено, але лист не вдалося надіслати. Спробуйте повторне надсилання нижче."
            : "Your account was created, but delivery failed. Try sending the email again below."}
        </p>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {token && !verified && (
        <button
          className="button primary full"
          disabled={busy}
          onClick={() => void verify()}
        >
          {busy
            ? uk
              ? "Перевіряємо…"
              : "Verifying…"
            : uk
              ? "Підтвердити пошту"
              : "Verify email"}
        </button>
      )}
      {!verified && (
        <form
          className="work-form section-gap"
          onSubmit={(event) => {
            event.preventDefault();
            void resend();
          }}
          aria-busy={busy}
        >
          <label htmlFor="verification-email">
            {uk ? "Електронна пошта" : "Email address"}
          </label>
          <input
            id="verification-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            disabled={busy}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button className="button secondary" disabled={busy || remaining > 0}>
            {remaining
              ? `${uk ? "Повторити через" : "Try again in"} ${remaining} ${uk ? "с" : "s"}`
              : uk
                ? "Надіслати лист повторно"
                : "Resend verification email"}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/login">{uk ? "Перейти до входу" : "Go to sign in"}</Link>
      </p>
    </section>
  );
}
