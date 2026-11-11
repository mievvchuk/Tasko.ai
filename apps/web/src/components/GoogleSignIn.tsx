import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";

// Кнопка Google Identity Services. Без VITE_GOOGLE_CLIENT_ID її не показуємо.
const clientId: string | undefined = import.meta.env?.VITE_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: "popup";
      }): void;
      renderButton(
        element: HTMLElement,
        options: Record<string, string | number>,
      ): void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let script: Promise<GoogleIdentity> | null = null;
function loadGoogle() {
  script ??= new Promise((resolve, reject) => {
    const element = document.createElement("script");
    element.src = "https://accounts.google.com/gsi/client";
    element.async = true;
    element.onload = () =>
      window.google ? resolve(window.google) : reject(new Error("google"));
    element.onerror = () => {
      script = null;
      reject(new Error("google"));
    };
    document.head.append(element);
  });
  return script;
}

export function GoogleSignIn({
  mode,
  rememberMe = false,
  role,
}: {
  mode: "signin" | "signup";
  rememberMe?: boolean;
  // Лише для реєстрації: роль нового акаунта
  role?: "CLIENT" | "FREELANCER";
}) {
  const { loginWithGoogle } = useAuth();
  const { t, tr, language } = useLanguage();
  const button = useRef<HTMLDivElement>(null);
  // Свіже значення для колбека Google, який створюється один раз
  const remember = useRef(rememberMe);
  remember.current = rememberMe;
  const chosenRole = useRef(role);
  chosenRole.current = role;
  const [credential, setCredential] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish(token: string, twoFactorCode?: string) {
    setBusy(true);
    setError("");
    try {
      const done = await loginWithGoogle(
        token,
        twoFactorCode,
        remember.current,
        chosenRole.current,
      );
      // 2FA увімкнено: просимо код і повторюємо запит з тим самим токеном
      if (!done) setCredential(token);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    loadGoogle()
      .then((google) => {
        if (!active || !button.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: ({ credential }) => void finish(credential),
        });
        google.accounts.id.renderButton(button.current, {
          type: "standard",
          theme:
            document.documentElement.dataset.theme === "dark"
              ? "filled_black"
              : "outline",
          size: "large",
          shape: "rectangular",
          text: mode === "signup" ? "signup_with" : "signin_with",
          locale: language === "en" ? "en" : "uk",
          width: Math.min(button.current.offsetWidth || 360, 400),
        });
      })
      .catch(() => {
        if (active) setError(tr("Не вдалося завантажити вхід через Google."));
      });
    return () => {
      active = false;
    };
  }, [language, mode]);

  if (!clientId) return null;

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) void finish(credential, code);
  }

  return (
    <div className="google-sign-in" aria-busy={busy}>
      {credential ? (
        <form className="form-fields" onSubmit={submitCode}>
          <div className="field">
            <label htmlFor="google-two-factor-code">{t("twoFactorCode")}</label>
            <input
              id="google-two-factor-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
              placeholder="000000"
            />
          </div>
          <button className="button primary full" disabled={busy}>
            {busy ? t("loggingIn") : t("signIn")}
          </button>
        </form>
      ) : (
        <div className="google-button" ref={button} />
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
