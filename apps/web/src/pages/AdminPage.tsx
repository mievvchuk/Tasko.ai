import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router";
import { downloadApiFile, request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage, formatDate } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { roleNames, taskStatusNames } from "../types";
import type {
  AdminUser,
  AdminReport,
  UserRole,
  TaskStatus,
  Complaint,
} from "../types";

export function AdminPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const role = Object.hasOwn(roleNames, params.get("role") || "")
    ? params.get("role") || ""
    : "";
  const status = ["ACTIVE", "BLOCKED"].includes(params.get("status") || "")
    ? params.get("status") || ""
    : "";
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  const users = useApi<AdminUser[]>(
    user?.role === "ADMIN" ? `/admin/users?${query}` : null,
  );
  const report = useApi<AdminReport>(
    user?.role === "ADMIN" ? "/admin/report" : null,
  );
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");
  async function exportReport(format: "json" | "csv" | "xlsx" | "pdf") {
    setExporting(format);
    setExportError("");
    try {
      await downloadApiFile(
        `/admin/report/export?format=${format}`,
        `tasko-report.${format}`,
      );
    } catch (error) {
      setExportError(errorMessage(error));
    } finally {
      setExporting("");
    }
  }
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  if (user?.role !== "ADMIN")
    return (
      <section className="account-panel">
        <h1>Доступ заборонено</h1>
        <p>Ця сторінка доступна лише адміністратору.</p>
      </section>
    );
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / АДМІНІСТРУВАННЯ</span>
        <h1>Адміністративна панель</h1>
        <p>Облікові записи та загальні показники системи.</p>
      </div>
      <ResourceState
        loading={report.loading}
        error={report.error}
        onRetry={report.refresh}
      />
      {report.data && (
        <>
          <div className="stats-grid">
            {[
              ["Користувачі", report.data.users],
              ["Заблоковані", report.data.blockedUsers],
              ["Проєкти", report.data.projects],
              ["Завдання", report.data.tasks],
            ].map(([label, value]) => (
              <article className="stat-card" key={label}>
                <span className="stat-label">{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <p className="form-note">
            Активні проєкти: {report.data.activeProjects} · Завершені:{" "}
            {report.data.completedProjects} · Прострочені завдання:{" "}
            {report.data.overdueTasks}.{" "}
            {Object.entries(report.data.tasksByStatus)
              .map(
                ([value, count]) =>
                  `${taskStatusNames[value as TaskStatus]}: ${count}`,
              )
              .join(" · ")}
          </p>
          <div className="export-actions" aria-label="Експорт звіту">
            <strong>Завантажити звіт:</strong>
            {(["json", "csv", "xlsx", "pdf"] as const).map((format) => (
              <button
                key={format}
                className="button secondary"
                disabled={Boolean(exporting)}
                onClick={() => exportReport(format)}
              >
                {exporting === format ? "Готуємо…" : format.toUpperCase()}
              </button>
            ))}
          </div>
          {exportError && (
            <p className="notice error" role="alert">
              {exportError}
            </p>
          )}
        </>
      )}
      <section className="data-panel">
        <div className="panel-heading">
          <h2>Користувачі</h2>
          <button
            className="button secondary"
            onClick={() => {
              users.refresh();
              report.refresh();
            }}
          >
            Оновити дані
          </button>
        </div>
        <div className="task-filters padded">
          <div className="filter-field">
            <label htmlFor="admin-role-filter">Роль</label>
            <select
              id="admin-role-filter"
              value={role}
              onChange={(event) => change("role", event.target.value)}
            >
              <option value="">Усі ролі</option>
              {Object.entries(roleNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="admin-status-filter">Стан облікового запису</label>
            <select
              id="admin-status-filter"
              value={status}
              onChange={(event) => change("status", event.target.value)}
            >
              <option value="">Усі стани</option>
              <option value="ACTIVE">Активний</option>
              <option value="BLOCKED">Заблокований</option>
            </select>
          </div>
        </div>
        <ResourceState
          loading={users.loading}
          error={users.error}
          onRetry={users.refresh}
        />
        {users.data && (
          <>
            <div className="padded">
              {!users.data.length && (
                <p className="form-note">
                  На цій сторінці користувачів не знайдено.
                </p>
              )}
              {users.data.map((person) => (
                <UserEditor
                  key={`${person.id}-${person.role}-${person.status}`}
                  user={person}
                  self={person.id === user.id}
                  onSaved={() => {
                    users.refresh();
                    report.refresh();
                  }}
                />
              ))}
            </div>
            <Pagination
              page={page}
              count={users.data.length}
              onChange={(value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              }}
            />
          </>
        )}
      </section>
      <AdminComplaints />
    </>
  );
}

function AdminComplaints() {
  const complaints = useApi<
    (Complaint & {
      reporter?: { name: string };
      targetUser?: { name: string };
      project?: { title: string };
    })[]
  >("/admin/complaints?limit=50");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  async function decide(id: string, status: "RESOLVED" | "REJECTED") {
    setError("");
    try {
      await request(`/admin/complaints/${id}`, {
        method: "PATCH",
        body: { status, adminNote: notes[id] || "Рішення адміністратора" },
      });
      complaints.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="data-panel projects-panel">
      <div className="panel-heading">
        <div>
          <h2>Модерація скарг</h2>
          <p>Рішення не блокує користувача автоматично.</p>
        </div>
      </div>
      {error && <p className="form-error padded">{error}</p>}
      <ResourceState
        loading={complaints.loading}
        error={complaints.error}
        onRetry={complaints.refresh}
      />
      {complaints.data?.map((item) => (
        <article className="application-card" key={item.id}>
          <div className="application-person">
            <h3>{item.reason}</h3>
            <span className={`project-status status-${item.status}`}>
              {item.status}
            </span>
          </div>
          <p>{item.description}</p>
          <small>
            Автор: {item.reporter?.name || item.id} · Ціль:{" "}
            {item.targetUser?.name || item.project?.title || "не вказано"}
          </small>
          {item.status === "OPEN" && (
            <div className="inline-form">
              <label>
                Коментар рішення
                <input
                  value={notes[item.id] || ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [item.id]: e.target.value })
                  }
                />
              </label>
              <button
                className="button primary"
                onClick={() => void decide(item.id, "RESOLVED")}
              >
                Вирішено
              </button>
              <button
                className="button secondary"
                onClick={() => void decide(item.id, "REJECTED")}
              >
                Відхилити
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function UserEditor({
  user,
  self,
  onSaved,
}: {
  user: AdminUser;
  self: boolean;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState(user.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: { role, status },
      });
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="user-card">
      <div className="record-heading">
        <div>
          <h3>
            {user.name}
            {self && " (ви)"}
          </h3>
          <p>{user.email}</p>
          <small>Зареєстровано: {formatDate(user.createdAt)}</small>
        </div>
        <span className={`project-status status-${user.status}`}>
          {user.status === "ACTIVE" ? "Активний" : "Заблокований"}
        </span>
      </div>
      <form onSubmit={save} className="work-form">
        <fieldset disabled={busy || self} className="user-controls">
          <div>
            <label htmlFor={`user-role-${user.id}`}>Роль користувача</label>
            <select
              id={`user-role-${user.id}`}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {Object.entries(roleNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`user-status-${user.id}`}>Стан користувача</label>
            <select
              id={`user-status-${user.id}`}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AdminUser["status"])
              }
            >
              <option value="ACTIVE">Активний</option>
              <option value="BLOCKED">Заблокований</option>
            </select>
          </div>
          <button
            className="button secondary"
            disabled={role === user.role && status === user.status}
          >
            {busy ? "Зберігаємо…" : "Зберегти користувача"}
          </button>
        </fieldset>
        {self && (
          <p className="form-note">
            Змінити власну роль або заблокувати себе не можна.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </form>
    </article>
  );
}
