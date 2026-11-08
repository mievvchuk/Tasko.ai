// Частини адміністративної панелі: таблиця, діалоги, фільтри, звіт і графіки.
// Патерни (таблиця з тулбаром і пагінацією, діалоги дій, картки-метрики)
// взято з shadcn-admin (MIT, © Sat Naing, https://github.com/satnaing/shadcn-admin).
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "react-router";
import { downloadApiFile, request, errorMessage } from "../api";
import { formatDate, parsePage } from "../format";
import { BarChart, ColumnChart } from "../components/Charts";
import {
  AverageRow,
  BreakdownTable,
  KpiGrid,
  LineChart,
} from "../components/Metrics";
import type { KpiItem } from "../components/Metrics";
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
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);
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
                    active
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : undefined
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

// Діалог зміни ролі та стану облікового запису (лише замовники й фрілансери;
// адміністраторів панель не змінює, а нові адміни — окремі акаунти з AdminCreateDialog).
export function UserDialog({
  user,
  onSaved,
  onClose,
}: {
  user: AdminUser;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { tr } = useLanguage();
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState(user.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unchanged = role === user.role && status === user.status;

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/admin/users/${user.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (error) {
      setError(errorMessage(error));
      setBusy(false);
    }
  }

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
        <fieldset disabled={busy} className="user-controls">
          <div>
            <label htmlFor={`user-role-${user.id}`}>
              {tr("Роль користувача")}
            </label>
            <select
              id={`user-role-${user.id}`}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <option value="CLIENT">{tr(roleNames.CLIENT)}</option>
              <option value="FREELANCER">{tr(roleNames.FREELANCER)}</option>
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
        <p className="form-note">
          {tr(
            "Роль адміністратора так не видається — створіть окремий акаунт адміністратора.",
          )}
        </p>
        {confirmDelete ? (
          <div className="notice error admin-delete-confirm" role="alert">
            <p>
              <strong>{tr("Видалити {0}?", user.name)}</strong>{" "}
              {tr(
                "Обліковий запис буде видалено повністю разом з його проєктами, повідомленнями, заявками, відгуками й файлами. У чужих проєктах завдання лишаться без виконавця. Дію не можна скасувати.",
              )}
            </p>
            <div className="admin-dialog-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {tr("Скасувати")}
              </button>
              <button
                className="button danger-outline"
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? tr("Видаляємо…") : tr("Так, видалити")}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="button danger-outline admin-delete-user"
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <i className="bi bi-trash3" aria-hidden="true"></i>
            {tr("Видалити користувача")}
          </button>
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

// Новий адміністратор — окремий акаунт; дію підтверджує паролем (і кодом 2FA) той, хто створює.
export function AdminCreateDialog({
  twoFactor,
  onSaved,
  onClose,
}: {
  twoFactor: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { tr } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      await request("/admin/admins", {
        method: "POST",
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          currentPassword: form.currentPassword,
          ...(twoFactor ? { twoFactorCode: form.twoFactorCode } : {}),
        },
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
      title={tr("Новий адміністратор")}
      description={tr(
        "Створюється окремий акаунт: роль адміністратора не видається наявним користувачам.",
      )}
      onClose={onClose}
    >
      <form onSubmit={save} className="work-form admin-dialog-form">
        <fieldset disabled={busy} className="admin-dialog-form">
          <label>
            {tr("Ім'я")}
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label>
            {tr("Електронна пошта")}
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            {tr("Пароль нового адміністратора")}
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            {tr("Ваш пароль для підтвердження")}
            <input
              name="currentPassword"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="current-password"
            />
          </label>
          {twoFactor && (
            <label>
              {tr("Код 2FA")}
              <input
                name="twoFactorCode"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </label>
          )}
        </fieldset>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            {tr("Скасувати")}
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? tr("Створюємо…") : tr("Створити адміністратора")}
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
        body: {
          status,
          adminNote: note.trim() || tr("Рішення адміністратора"),
        },
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

export function StatusPill({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
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
// Огляд у вигляді плиток із підказками, середніх часів, активності за тиждень і розбивки
export function AdminStats({ report }: { report: AdminReport }) {
  const { tr } = useLanguage();
  const main: KpiItem[] = [
    {
      label: tr("На модерації"),
      value: report.projectsByStatus.MODERATION ?? 0,
      icon: "bi-patch-question",
      tone: "accent",
      hint: tr("Нові проєкти, які чекають на рішення адміністратора."),
    },
    {
      label: tr("Користувачі"),
      value: report.users,
      icon: "bi-people",
      tone: "primary",
      hint: tr("Усі облікові записи платформи."),
    },
    {
      label: tr("Нові користувачі за 7 днів"),
      value: report.week.users,
      icon: "bi-person-plus",
      tone: "success",
      hint: tr("Зареєструвалися за останні 7 днів, включно з сьогодні."),
    },
    {
      label: tr("Проєкти"),
      value: report.projects,
      icon: "bi-folder",
      tone: "primary",
      hint: tr("Усі проєкти незалежно від статусу."),
    },
    {
      label: tr("Нові проєкти за 7 днів"),
      value: report.week.projects,
      icon: "bi-folder-plus",
      tone: "success",
      hint: tr("Створені за останні 7 днів."),
    },
    {
      label: tr("Шукають виконавця"),
      value: report.projectsByStatus.PLANNING,
      icon: "bi-hourglass-split",
      tone: "accent",
      hint: tr("Проєкти на біржі, для яких ще не обрано фрілансера."),
    },
    {
      label: tr("Активні проєкти"),
      value: report.activeProjects,
      icon: "bi-lightning-charge",
      tone: "primary",
      hint: tr("Виконавця обрано, триває робота."),
    },
    {
      label: tr("Завершені проєкти"),
      value: report.completedProjects,
      icon: "bi-check2-circle",
      tone: "success",
      hint: tr("Роботу прийнято клієнтом."),
    },
    {
      label: tr("Заблоковані користувачі"),
      value: report.blockedUsers,
      icon: "bi-slash-circle",
      tone: "danger",
      hint: tr("Облікові записи, яким адміністратор закрив доступ."),
    },
  ];
  const complaints: KpiItem[] = [
    {
      label: tr("Нові за 7 днів"),
      value: report.week.complaints,
      icon: "bi-plus-lg",
      tone: "primary",
      hint: tr("Скарги, подані за останні 7 днів."),
    },
    {
      label: tr("Очікують розгляду"),
      value: report.complaintsByStatus.OPEN,
      icon: "bi-exclamation-lg",
      tone: "accent",
      hint: tr("Скарги без рішення адміністратора."),
    },
    {
      label: tr("Вирішено"),
      value: report.complaintsByStatus.RESOLVED,
      icon: "bi-check-lg",
      tone: "success",
      hint: tr("Скарги, за якими вжито заходів."),
    },
    {
      label: tr("Відхилено"),
      value: report.complaintsByStatus.REJECTED,
      icon: "bi-x-lg",
      tone: "danger",
      hint: tr("Скарги, які не підтвердилися."),
    },
  ];
  const applications: KpiItem[] = [
    {
      label: tr("Нові за 7 днів"),
      value: report.week.applications,
      icon: "bi-send",
      tone: "primary",
      hint: tr("Заявки фрілансерів за останні 7 днів."),
    },
    {
      label: tr("Очікують рішення"),
      value: report.applicationsByStatus.PENDING,
      icon: "bi-clock",
      tone: "accent",
      hint: tr("Клієнт ще не прийняв і не відхилив заявку."),
    },
    {
      label: tr("Прийнято"),
      value: report.applicationsByStatus.ACCEPTED,
      icon: "bi-person-check",
      tone: "success",
      hint: tr("Заявки, за якими обрано виконавця."),
    },
    {
      label: tr("Відхилено"),
      value: report.applicationsByStatus.REJECTED,
      icon: "bi-person-x",
      tone: "danger",
      hint: tr("Заявки, які клієнт відхилив."),
    },
  ];
  const tasks: KpiItem[] = [
    {
      label: tr("У процесі"),
      value: report.tasksByStatus.IN_PROGRESS,
      icon: "bi-arrow-repeat",
      tone: "primary",
      hint: tr("Завдання, над якими зараз працюють."),
    },
    {
      label: tr("На перевірці"),
      value: report.tasksByStatus.REVIEW,
      icon: "bi-eye",
      tone: "accent",
      hint: tr("Роботу здано, клієнт ще не прийняв."),
    },
    {
      label: tr("Завершено"),
      value: report.tasksByStatus.DONE,
      icon: "bi-check2-all",
      tone: "success",
      hint: tr("Прийняті завдання."),
    },
    {
      label: tr("Прострочені"),
      value: report.overdueTasks,
      icon: "bi-alarm",
      tone: "danger",
      hint: tr("Незавершені завдання з дедлайном у минулому."),
    },
  ];
  const groups: [string, KpiItem[]][] = [
    [tr("Скарги"), complaints],
    [tr("Заявки"), applications],
    [tr("Завдання"), tasks],
  ];
  const days = report.week.days;
  return (
    <div className="admin-overview-stack">
      <KpiGrid items={main} label={tr("Основні показники")} />
      <AverageRow
        items={[
          {
            label: tr("Середній час розгляду скарги"),
            value: formatHours(report.averageHours.complaintResolution, tr),
            hint: tr("Від подання скарги до рішення адміністратора."),
          },
          {
            label: tr("Середній час до першої заявки"),
            value: formatHours(report.averageHours.firstApplication, tr),
            hint: tr("Від створення проєкту до першої заявки фрілансера."),
          },
          {
            label: tr("Середній час до вибору виконавця"),
            value: formatHours(report.averageHours.hire, tr),
            hint: tr("Від створення проєкту до прийнятої заявки."),
          },
        ]}
      />
      <div className="admin-kpi-groups">
        {groups.map(([title, items]) => (
          <section key={title}>
            <h2>{title}</h2>
            <KpiGrid items={items} label={title} compact />
          </section>
        ))}
      </div>
      <div className="admin-activity">
        <LineChart
          title={tr("Активність за 7 днів")}
          labels={days.map(({ day }) => dayLabel(day))}
          series={[
            {
              name: tr("Користувачі"),
              tone: "primary",
              values: days.map((row) => row.users),
            },
            {
              name: tr("Проєкти"),
              tone: "success",
              values: days.map((row) => row.projects),
            },
            {
              name: tr("Скарги"),
              tone: "danger",
              values: days.map((row) => row.complaints),
            },
          ]}
        />
        <BreakdownTable
          title={tr("Користувачі за ролями")}
          column={[tr("Роль"), tr("Кількість"), tr("Частка")]}
          totalLabel={tr("Усього")}
          rows={(Object.keys(roleNames) as UserRole[]).map((role) => ({
            label: tr(roleNames[role]),
            value: report.usersByRole[role],
          }))}
        />
      </div>
    </div>
  );
}

// 0.5 → «30 хв», 5 → «5 год», 50 → «2,1 дн.»; null → «—»
export function formatHours(
  hours: number | null,
  tr: (text: string, ...args: (string | number)[]) => string,
) {
  if (hours === null) return "—";
  const number = (value: number) =>
    value.toLocaleString(uiLocale(), { maximumFractionDigits: 1 });
  if (hours < 1) return tr("{0} хв", Math.round(hours * 60));
  if (hours < 48) return tr("{0} год", number(hours));
  return tr("{0} дн.", number(hours / 24));
}

// «2026-11-07» → «07.11»
function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(uiLocale(), {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
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
        items={(Object.keys(taskStatusNames) as TaskStatus[]).map((status) => ({
          label: tr(taskStatusNames[status]),
          value: report.tasksByStatus[status],
          tone: taskTones[status],
        }))}
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
  MODERATION: "accent",
  REJECTED: "danger",
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
