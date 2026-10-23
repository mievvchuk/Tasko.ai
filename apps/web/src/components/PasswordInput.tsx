import { useState } from "react";
import { useLanguage } from "../i18n";

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  autoComplete: "current-password" | "new-password";
}

export function PasswordInput({
  id,
  value,
  onChange,
  label,
  autoComplete,
}: PasswordInputProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const displayLabel = label || t("password");
  return (
    <div className="field">
      <label htmlFor={id}>{displayLabel}</label>
      <div className="password-field">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
          maxLength={128}
          placeholder={
            displayLabel === t("password")
              ? t("enterPassword")
              : t("enterPasswordAgain")
          }
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
