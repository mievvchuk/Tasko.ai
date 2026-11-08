import { passwordStrength } from "../format";
import { useLanguage } from "../i18n";

const strengthNames = ["", "Легкий", "Середній", "Складний", "Дуже складний"];

// Смужка складності під полем нового пароля (реєстрація й зміна пароля)
export function PasswordStrength({ password }: { password: string }) {
  const { t, tr } = useLanguage();
  const strength = passwordStrength(password);
  if (!password) return <p className="field-hint">{t("passwordHint")}</p>;
  return (
    <div className={`password-strength level-${strength}`} aria-live="polite">
      <span className="password-strength-bar" aria-hidden="true">
        <i></i>
      </span>
      <span>
        {tr("Складність:")} <strong>{tr(strengthNames[strength])}</strong>
        {password.length < 8 && ` · ${t("passwordHint")}`}
      </span>
    </div>
  );
}
