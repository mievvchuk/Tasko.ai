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
          <i
            className={visible ? "bi bi-eye-slash" : "bi bi-eye"}
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>
  );
}
