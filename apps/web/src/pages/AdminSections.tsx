// Частини адміністративної панелі: звіт, модерація скарг і картка користувача.
import { useState } from "react";
import type { FormEvent } from "react";
import { downloadApiFile, request, errorMessage } from "../api";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
import { BarChart, ColumnChart } from "../components/Charts";
import type { ChartTone } from "../components/Charts";
import { projectStatusNames, roleNames, taskStatusNames } from "../types";
import type {
  AdminUser,
  AdminReport,
  UserRole,
  TaskStatus,
  ProjectStatus,
  Complaint,
} from "../types";

import { useLanguage } from "../i18n";
import { uiLocale } from "../i18n.en";
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
  const { tr } = useLanguage();
  return (
    <>
      {Object.entries(roleNames).map(([value, label]) => (
        <option key={value} value={value}>
          {tr(label)}
        </option>
      ))}
    </>
  );
}

export function AccountStatusOptions() {
  const { tr } = useLanguage();
  return (
    <>
      <option value="ACTIVE">{tr(accountStatusNames.ACTIVE)}</option>
      <option value="BLOCKED">{tr(accountStatusNames.BLOCKED)}</option>
    </>
  );
}

// Загальні показники системи та кнопки експорту звіту.
export function AdminReportSummary({ report }: { report: AdminReport }) {
  const { tr } = useLanguage();
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
    [
      tr("Користувачі"),
      report.users,
      tr("заблоковано: {0}", report.blockedUsers),
    ],
    [tr("Проєкти"), report.projects, tr("активні: {0}", report.activeProjects)],
    [
      tr("Завдання"),
      report.tasks,
      tr("завершено: {0}", report.tasksByStatus.DONE),
    ],
    [tr("Прострочені"), report.overdueTasks, tr("завдань після дедлайну")],
  ] as const;

  return (
    <>
      <div className="stats-grid">
        {stats.map(([label, value, note]) => (
          <article className="stat-card" key={label}>
            <span className="stat-label">{label}</span>
            <strong>{value}</strong>
            <span className="stat-note">{note}</span>
          </article>
        ))}
      </div>
      <div className="chart-grid">
        <ColumnChart
          title={tr("Нові за останні 6 місяців")}
          labels={report.growth.map(({ month }) => monthLabel(month))}
          series={[
            {
              name: tr("Користувачі"),
              tone: "primary",
              values: report.growth.map((row) => row.users),
            },
            {
              name: tr("Проєкти"),
              tone: "accent",
              values: report.growth.map((row) => row.projects),
            },
          ]}
        />
        <BarChart
          title={tr("Користувачі за ролями")}
          items={(Object.keys(roleNames) as UserRole[]).map((role) => ({
            label: tr(roleNames[role]),
            value: report.usersByRole[role],
            tone: roleTones[role],
          }))}
        />
        <BarChart
          title={tr("Проєкти за статусами")}
          items={(Object.keys(projectStatusNames) as ProjectStatus[]).map(
            (status) => ({
              label: tr(projectStatusNames[status]),
              value: report.projectsByStatus[status],
              tone: projectTones[status],
            }),
          )}
        />
        <BarChart
          title={tr("Завдання за статусами")}
          items={(Object.keys(taskStatusNames) as TaskStatus[]).map(
            (status) => ({
              label: tr(taskStatusNames[status]),
              value: report.tasksByStatus[status],
              tone: taskTones[status],
            }),
          )}
        />
      </div>
      <div className="export-actions" aria-label={tr("Експорт звіту")}>
        <strong>{tr("Завантажити звіт:")}</strong>
        {reportFormats.map((format) => (
          <button
            key={format}
            className="button secondary"
            disabled={Boolean(exporting)}
            onClick={() => exportReport(format)}
          >
            <i className="bi bi-download" aria-hidden="true"></i>
            {exporting === format ? tr("Готуємо…") : format.toUpperCase()}
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

// Кольори статусів, як у DESIGN-SYSTEM.md (розділ 01)
const roleTones: Record<UserRole, ChartTone> = {
  CLIENT: "accent",
  FREELANCER: "primary",
  ADMIN: "muted",
};
const taskTones: Record<TaskStatus, ChartTone> = {
  TODO: "muted",
  IN_PROGRESS: "primary",
  REVIEW: "accent",
  DONE: "success",
};
const projectTones: Record<ProjectStatus, ChartTone> = {
  PLANNING: "muted",
  ACTIVE: "primary",
  PAUSED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};

// «2026-10» → «жовт.»
function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString(uiLocale(), {
    month: "short",
  });
}

export function AdminComplaints() {
  const { tr } = useLanguage();
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
        body: { status, adminNote: notes[id] || tr("Рішення адміністратора") },
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
          <h2>{tr("Модерація скарг")}</h2>
          <p>{tr("Рішення не блокує користувача автоматично.")}</p>
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
            {tr("Автор:")} {item.reporter?.name || item.id} {tr("· Ціль:")}{" "}
            {item.targetUser?.name || item.project?.title || tr("не вказано")}
          </small>
          {item.status === "OPEN" && (
            <div className="inline-form">
              <label>
                {tr("Коментар рішення")}
                <input
                  value={notes[item.id] || ""}
                  onChange={(e) => changeNote(item.id, e.target.value)}
                />
              </label>
              <button
                className="button primary"
                onClick={() => void decide(item.id, "RESOLVED")}
              >
                {tr("Вирішено")}
              </button>
              <button
                className="button secondary"
                onClick={() => void decide(item.id, "REJECTED")}
              >
                {tr("Відхилити")}
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
  const { tr } = useLanguage();
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
            {self && tr(" (ви)")}
          </h3>
          <p>{user.email}</p>
          <small>
            {tr("Зареєстровано:")} {formatDate(user.createdAt)}
          </small>
        </div>
        <span className={`project-status status-${user.status}`}>
          {tr(accountStatusNames[user.status])}
        </span>
      </div>
      <form onSubmit={save} className="work-form">
        {/* Власний обліковий запис адміністратор змінювати не може. */}
        <fieldset disabled={busy || self} className="user-controls">
          <div>
            <label htmlFor={`user-role-${user.id}`}>
              {tr("Роль користувача")}
            </label>
            <select
              id={`user-role-${user.id}`}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <RoleOptions />
            </select>
          </div>
          <div>
            <label htmlFor={`user-status-${user.id}`}>
              {tr("Стан користувача")}
            </label>
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
            {busy ? tr("Зберігаємо…") : tr("Зберегти користувача")}
          </button>
        </fieldset>
        {self && (
          <p className="form-note">
            {tr("Змінити власну роль або заблокувати себе не можна.")}
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
