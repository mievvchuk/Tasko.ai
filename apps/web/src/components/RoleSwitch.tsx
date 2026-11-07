import { useState } from "react";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import type { User } from "../types";

// Вибір ролі після реєстрації: на вітальній сторінці й у профілі.
// Сервер дозволяє зміну, лише поки немає проєктів і заявок.
export function RoleSwitch() {
  const { tr } = useLanguage();
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!user || user.role === "ADMIN") return null;
  const role = user.role;

  async function choose(next: "CLIENT" | "FREELANCER") {
    if (next === role || saving) return;
    setSaving(true);
    setError("");
    try {
      updateUser(
        await request<User>("/profile/role", {
          method: "PATCH",
          body: { role: next },
        }),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="role-switch">
      <div
        className="segmented"
        role="group"
        aria-label={tr("Що ви плануєте робити?")}
        aria-busy={saving}
      >
        <button
          type="button"
          aria-pressed={role === "CLIENT"}
          disabled={saving}
          onClick={() => void choose("CLIENT")}
        >
          <i className="bi bi-briefcase" aria-hidden="true"></i>
          {tr("Шукаю виконавця")}
        </button>
        <button
          type="button"
          aria-pressed={role === "FREELANCER"}
          disabled={saving}
          onClick={() => void choose("FREELANCER")}
        >
          <i className="bi bi-laptop" aria-hidden="true"></i>
          {tr("Шукаю замовлення")}
        </button>
      </div>
      <p className="field-hint">
        {tr("Роль можна змінити в профілі, поки у вас немає проєктів і заявок.")}
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
