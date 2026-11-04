// Частини адміністративної панелі: таблиця, діалоги, фільтри, звіт і графіки.
// Патерни (таблиця з тулбаром і пагінацією, діалоги дій, картки-метрики)
// взято з shadcn-admin (MIT, © Sat Naing, https://github.com/satnaing/shadcn-admin).
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { downloadApiFile, request, errorMessage } from "../api";
import { formatDate, parsePage } from "../format";
import { BarChart, ColumnChart } from "../components/Charts";
import type { ChartTone } from "../components/Charts";
import {
  complaintStatusNames,
  projectStatusNames,
  roleNames,
  taskStatusNames,
} from "../types";
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
export type ComplaintWithDetails = Complaint & {
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

// Повертає значення, якщо воно є серед дозволених, інакше порожній рядок.
export function allowedOrEmpty(value: string | null, allowed: string[]) {
  return value && allowed.includes(value) ? value : "";
}

// Сторінка й фільтри списку живуть в адресному рядку; зміна фільтра повертає на 1-шу сторінку.
export function useListParams() {
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const search = (params.get("search") ?? "").slice(0, 100);
  function set(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (name !== "page") next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  return { params, page, search, set, reset: () => setParams({}) };
}

// Тулбар таблиці: пошук і фільтри-списки (children), кнопка скидання.
export function ListToolbar({
  search,
  placeholder,
  filtered,
  onSearch,
  onReset,
  children,
}: {
  search: string;
  placeholder: string;
  filtered: boolean;
  onSearch: (value: string) => void;
  onReset: () => void;
  children?: ReactNode;
}) {
  const { tr } = useLanguage();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(String(new FormData(event.currentTarget).get("search")).trim());
  }
  return (
    <div className="admin-toolbar">
      <form className="admin-toolbar-search" role="search" onSubmit={submit}>
        <input
          key={search}
          name="search"
          type="search"
          maxLength={100}
          defaultValue={search}
          aria-label={placeholder}
          placeholder={placeholder}
        />
        <button className="button secondary" type="submit">
          <i className="bi bi-search" aria-hidden="true"></i>
          <span className="visually-hidden">{tr("Знайти")}</span>
        </button>
      </form>
      {children}
      {filtered && (
        <button className="button ghost" type="button" onClick={onReset}>
          {tr("Скинути")}
          <i className="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}

// Фільтр-список у тулбарі; підпис видно лише програмі читання екрана.
export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="admin-filter">
      <span className="visually-hidden">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  // Значення для сортування; без нього стовпець не сортується
  sort?: (row: T) => string | number;
}

// Таблиця зі стовпцями, що сортуються кліком по заголовку (зростання → спадання → без сортування).
// shortcut: сортує лише поточну сторінку з сервера; для сортування всієї бази потрібен параметр sort в API.
export function DataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  empty,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  empty: string;
}) {
  const { tr } = useLanguage();
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(
    null,
  );
  const sortBy = columns.find((column) => column.key === sort?.key)?.sort;
  const sorted = sortBy
    ? [...rows].sort((a, b) => {
        const left = sortBy(a);
        const right = sortBy(b);
        const order =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), uiLocale());
        return sort?.desc ? -order : order;
      })
    : rows;

  function toggle(key: string) {
    if (sort?.key !== key) setSort({ key, desc: false });
    else if (!sort.desc) setSort({ key, desc: true });
    else setSort(null);
  }

  return (
    <div className="table-scroll">
      <table className="admin-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active ? (sort.desc ? "descending" : "ascending") : undefined
                  }
                >
                  {column.sort ? (
                    <button type="button" onClick={() => toggle(column.key)}>
                      {column.label}
                      <i
                        className={`bi ${
                          active
                            ? sort.desc
                              ? "bi-arrow-down"
                              : "bi-arrow-up"
                            : "bi-arrow-down-up"
                        }`}
                        aria-hidden="true"
                      ></i>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key} data-label={column.label}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {!sorted.length && (
            <tr className="admin-table-empty">
              <td colSpan={columns.length}>{empty || tr("Немає даних.")}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Модальний діалог на <dialog>: фокус, Esc і клік по фону закривають його.
export function AdminDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { tr } = useLanguage();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby={id}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) ref.current?.close();
      }}
    >
      <div className="admin-dialog-body">
        <div className="admin-dialog-heading">
          <div>
            {/* Фокус на заголовку, а не на хрестику: інакше хрестик одразу в рамці фокуса */}
            <h2 id={id} tabIndex={-1} autoFocus>
              {title}
            </h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="admin-dialog-close"
            aria-label={tr("Закрити")}
            onClick={() => ref.current?.close()}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// Діалог зміни ролі та стану облікового запису.
export function UserDialog({
  user,
  self,
  onSaved,
  onClose,
}: {
  user: AdminUser;
  self: boolean;
  onSaved: () => void;
  onClose: () => void;
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
      onClose();
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      title={tr("Редагувати користувача")}
      description={`${user.name} · ${user.email}`}
      onClose={onClose}
    >
      <form onSubmit={save} className="work-form admin-dialog-form">
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
        <div className="admin-dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {tr("Скасувати")}
          </button>
          <button className="button primary" disabled={unchanged || busy}>
            {busy ? tr("Зберігаємо…") : tr("Зберегти користувача")}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

// Діалог скарги: подробиці та, для відкритої, рішення з коментарем.
export function ComplaintDialog({
  complaint,
  onDecided,
  onClose,
}: {
  complaint: ComplaintWithDetails;
  onDecided: () => void;
  onClose: () => void;
}) {
  const { tr } = useLanguage();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(status: "RESOLVED" | "REJECTED") {
    setBusy(true);
    setError("");
    try {
      await request(`/admin/complaints/${complaint.id}`, {
        method: "PATCH",
        body: { status, adminNote: note.trim() || tr("Рішення адміністратора") },
      });
      onDecided();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <AdminDialog
      title={complaint.reason}
      description={tr("Рішення не блокує користувача автоматично.")}
      onClose={onClose}
    >
      <dl className="admin-details">
        <dt>{tr("Статус")}</dt>
        <dd>
          <StatusPill
            status={complaint.status}
            label={tr(complaintStatusNames[complaint.status])}
          />
        </dd>
        <dt>{tr("Автор")}</dt>
        <dd>{complaint.reporter?.name || tr("не вказано")}</dd>
        <dt>{tr("Ціль")}</dt>
        <dd>{complaintTarget(complaint) || tr("не вказано")}</dd>
        <dt>{tr("Створено")}</dt>
        <dd>{formatDate(complaint.createdAt, true)}</dd>
        <dt>{tr("Опис")}</dt>
        <dd>{complaint.description}</dd>
        {complaint.adminNote && (
          <>
            <dt>{tr("Коментар рішення")}</dt>
            <dd>{complaint.adminNote}</dd>
          </>
        )}
      </dl>
      {complaint.status === "OPEN" && (
        <div className="work-form admin-dialog-form">
          <label htmlFor="complaint-note">{tr("Коментар рішення")}</label>
          <textarea
            id="complaint-note"
            rows={3}
            maxLength={1000}
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
          />
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void decide("REJECTED")}
            >
              {tr("Відхилити")}
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void decide("RESOLVED")}
            >
              {tr("Вирішено")}
            </button>
          </div>
        </div>
      )}
    </AdminDialog>
  );
}

export function complaintTarget(complaint: ComplaintWithDetails) {
  return complaint.targetUser?.name || complaint.project?.title || "";
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  return <span className={`project-status status-${status}`}>{label}</span>;
}

// Кнопки завантаження звіту у форматах JSON/CSV/XLSX/PDF.
export function ReportExport() {
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

  return (
    <div className="admin-export">
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
    </div>
  );
}

// Картки-метрики дашборда.
export function AdminStats({ report }: { report: AdminReport }) {
  const { tr } = useLanguage();
  const stats = [
    [
      tr("Користувачі"),
      "bi-people",
      report.users,
      tr("заблоковано: {0}", report.blockedUsers),
    ],
    [
      tr("Проєкти"),
      "bi-folder",
      report.projects,
      tr("активні: {0}", report.activeProjects),
    ],
    [
      tr("Завдання"),
      "bi-check2-square",
      report.tasks,
      tr("завершено: {0}", report.tasksByStatus.DONE),
    ],
    [
      tr("Прострочені"),
      "bi-alarm",
      report.overdueTasks,
      tr("завдань після дедлайну"),
    ],
  ] as const;
  return (
    <div className="stats-grid admin-stats">
      {stats.map(([label, icon, value, note]) => (
        <article className="stat-card" key={label}>
          <span className="stat-label">
            {label}
            <i className={`bi ${icon}`} aria-hidden="true"></i>
          </span>
          <strong>{value}</strong>
          <span className="stat-note">{note}</span>
        </article>
      ))}
    </div>
  );
}

export function GrowthChart({ report }: { report: AdminReport }) {
  const { tr } = useLanguage();
  return (
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
  );
}

export function BreakdownCharts({ report }: { report: AdminReport }) {
  const { tr } = useLanguage();
  return (
    <div className="admin-breakdown">
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
