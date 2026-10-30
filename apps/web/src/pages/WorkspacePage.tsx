import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { formatDate } from "../format";
import { roleNames } from "../types";
import type { DashboardSummary, User } from "../types";
import { useApi } from "../useApi";
import { SecuritySettings } from "../components/SecuritySettings";
import { FreelancerProfileEditor } from "../components/FreelancerProfileEditor";
import { UserAvatar } from "../components/UserAvatar";

import { useLanguage } from "../i18n";
const maxPhotoSize = 2 * 1024 * 1024;
const photoTypes = ["image/png", "image/jpeg", "image/webp"];

// Сторінка «Мій профіль»: фото, ім'я, статистика, профіль фрилансера та безпека
export function WorkspacePage() {
  const { tr } = useLanguage();
  const { user, updateUser } = useAuth();
  const stats = useApi<DashboardSummary>("/analytics/dashboard");
  const fileInput = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!user) return null;

  // Спільна обгортка: блокує кнопки, показує помилку чи підтвердження
  async function run(action: () => Promise<User>, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      updateUser(await action());
      setMessage(success);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Швидка перевірка в браузері; остаточна — на сервері за вмістом файлу
    if (!photoTypes.includes(file.type) || file.size > maxPhotoSize) {
      setMessage("");
      setError(tr("Оберіть фото PNG, JPG або WEBP розміром до 2 МБ."));
      return;
    }
    const body = new FormData();
    body.append("file", file);
    await run(
      () => request<User>("/profile/avatar", { method: "POST", body }),
      tr("Фото профілю оновлено."),
    );
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await run(
      () =>
        request<User>("/profile/account", {
          method: "PATCH",
          body: { name },
        }),
      tr("Ім'я збережено."),
    );
    if (saved) setEditingName(false);
  }

  const statItems = stats.data
    ? [
        { label: tr("Проєкти"), value: stats.data.projects },
        { label: tr("Активні проєкти"), value: stats.data.activeProjects },
        { label: tr("Завдання"), value: stats.data.tasks },
        { label: tr("Виконано"), value: stats.data.completedTasks },
      ]
    : [];

  return (
    <>
      <div className="page-heading">
        <h1>{tr("Мій профіль")}</h1>
        <p>
          {tr(
            "Фото, особисті дані, профіль виконавця та безпека облікового запису.",
          )}
        </p>
      </div>

      <section
        className="data-panel profile-hero"
        aria-labelledby="profile-name"
      >
        <div className="profile-photo">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="xl" />
          <input
            ref={fileInput}
            id="profile-photo-input"
            className="visually-hidden"
            type="file"
            accept={photoTypes.join(",")}
            disabled={busy}
            onChange={(event) => void uploadPhoto(event)}
          />
          <div className="profile-photo-actions">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <i className="bi bi-camera" aria-hidden="true"></i>
              {user.avatarUrl ? tr("Змінити фото") : tr("Додати фото")}
            </button>
            {user.avatarUrl && (
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      request<User>("/profile/avatar", { method: "DELETE" }),
                    tr("Фото профілю видалено."),
                  )
                }
              >
                <i className="bi bi-trash3" aria-hidden="true"></i>

                {tr("Видалити")}
              </button>
            )}
          </div>
          <small className="form-note">
            {tr("PNG, JPG або WEBP, до 2 МБ")}
          </small>
        </div>

        <div className="profile-info">
          {editingName ? (
            <form className="profile-name-form" onSubmit={saveName}>
              <label htmlFor="profile-name-input">{tr("Ім'я")}</label>
              <div>
                <input
                  id="profile-name-input"
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
                <button className="button primary" disabled={busy}>
                  {tr("Зберегти")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setEditingName(false)}
                >
                  {tr("Скасувати")}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-name-row">
              <h2 id="profile-name">{user.name}</h2>
              <button
                type="button"
                className="icon-action"
                aria-label={tr("Змінити ім'я")}
                title={tr("Змінити ім'я")}
                onClick={() => {
                  setName(user.name);
                  setEditingName(true);
                }}
              >
                <i className="bi bi-pencil" aria-hidden="true"></i>
              </button>
            </div>
          )}
          <span className="role-pill">{tr(roleNames[user.role])}</span>
          <dl className="profile-facts">
            <div>
              <dt>
                <i className="bi bi-envelope" aria-hidden="true"></i>

                {tr("Пошта")}
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <i className="bi bi-calendar3" aria-hidden="true"></i>
                {tr("У Tasko.ai з")}
              </dt>
              <dd>{formatDate(user.createdAt ?? null)}</dd>
            </div>
            <div>
              <dt>
                <i className="bi bi-shield-lock" aria-hidden="true"></i>

                {tr("Двофакторний вхід")}
              </dt>
              <dd>
                {user.twoFactorEnabled ? tr("Увімкнено") : tr("Вимкнено")}
              </dd>
            </div>
          </dl>
          {user.role === "FREELANCER" && (
            <Link
              className="profile-public-link"
              to={`/freelancers/${user.id}`}
            >
              <i className="bi bi-eye" aria-hidden="true"></i>

              {tr("Як мій профіль бачать клієнти")}
            </Link>
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
        </div>

        {statItems.length > 0 && (
          <ul className="profile-stats" aria-label={tr("Статистика")}>
            {statItems.map((item) => (
              <li key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === "FREELANCER" && <FreelancerProfileEditor />}
      <SecuritySettings user={user} />
    </>
  );
}
