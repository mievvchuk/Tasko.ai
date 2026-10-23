// Частини адміністративної панелі: звіт, модерація скарг і картка користувача.
import { useState } from "react";
import type { FormEvent } from "react";
import { downloadApiFile, request, errorMessage } from "../api";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
import { roleNames, taskStatusNames } from "../types";
import type {
  AdminUser,
  AdminReport,
  UserRole,
  TaskStatus,
  Complaint,
} from "../types";

type AccountStatus = AdminUser["status"];
type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export const accountStatusNames: Record<AccountStatus, string> = {
  ACTIVE: "Активний",
  BLOCKED: "Заблокований",
};

const reportFormats: ReportFormat[] = ["json", "csv", "xlsx", "pdf"];

// Скарга разом з іменами учасників, які додає сервер.
type ComplaintWithDetails = Complaint & {
  reporter?: { name: string };
  targetUser?: { name: string };
  project?: { title: string };
};

export function RoleOptions() {
  return (
    <>
      {Object.entries(roleNames).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

export function AccountStatusOptions() {
  return (
    <>
      <option value="ACTIVE">{accountStatusNames.ACTIVE}</option>
      <option value="BLOCKED">{accountStatusNames.BLOCKED}</option>
    </>
  );
}

// Загальні показники системи та кнопки експорту звіту.
export function AdminReportSummary({ report }: { report: AdminReport }) {
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");

  async function exportReport(format: ReportFormat) {
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

  const stats = [
    ["Користувачі", report.users],
    ["Заблоковані", report.blockedUsers],
    ["Проєкти", report.projects],
    ["Завдання", report.tasks],
  ] as const;

  return (
    <>
      <div className="stats-grid">
        {stats.map(([label, value]) => (
          <article className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <p className="form-note">
        Активні проєкти: {report.activeProjects} · Завершені:{" "}
        {report.completedProjects} · Прострочені завдання: {report.overdueTasks}
        . {formatTasksByStatus(report.tasksByStatus)}
      </p>
      <div className="export-actions" aria-label="Експорт звіту">
        <strong>Завантажити звіт:</strong>
        {reportFormats.map((format) => (
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
  );
}

// Наприклад: «До виконання: 3 · У роботі: 2».
function formatTasksByStatus(tasksByStatus: AdminReport["tasksByStatus"]) {
  return Object.entries(tasksByStatus)
    .map(
      ([status, count]) => `${taskStatusNames[status as TaskStatus]}: ${count}`,
    )
    .join(" · ");
}

export function AdminComplaints() {
  const complaints = useApi<ComplaintWithDetails[]>(
    "/admin/complaints?limit=50",
  );
  // Коментарі адміністратора до кожної скарги: ключ — id скарги.
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

  function changeNote(id: string, note: string) {
    setNotes({ ...notes, [id]: note });
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
                  onChange={(e) => changeNote(item.id, e.target.value)}
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

// Картка користувача з формою зміни ролі та стану облікового запису.
export function AdminUserCard({
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
  const unchanged = role === user.role && status === user.status;

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
          {accountStatusNames[user.status]}
        </span>
      </div>
      <form onSubmit={save} className="work-form">
        {/* Власний обліковий запис адміністратор змінювати не може. */}
        <fieldset disabled={busy || self} className="user-controls">
          <div>
            <label htmlFor={`user-role-${user.id}`}>Роль користувача</label>
            <select
              id={`user-role-${user.id}`}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <RoleOptions />
            </select>
          </div>
          <div>
            <label htmlFor={`user-status-${user.id}`}>Стан користувача</label>
            <select
              id={`user-status-${user.id}`}
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AccountStatus)
              }
            >
              <AccountStatusOptions />
            </select>
          </div>
          <button className="button secondary" disabled={unchanged}>
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
