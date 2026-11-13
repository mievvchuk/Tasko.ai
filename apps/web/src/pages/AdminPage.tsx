import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { roleNames } from "../types";
import type { AdminUser, AdminReport } from "../types";
import {
  AccountStatusOptions,
  AdminCreateDialog,
  AdminStats,
  BreakdownCharts,
  DataTable,
  FilterSelect,
  GrowthChart,
  ListToolbar,
  ReportExport,
  RoleOptions,
  StatusPill,
  UserDialog,
  accountStatusNames,
  allowedOrEmpty,
  useListParams,
} from "./AdminSections";
import type { Column, UserAction } from "./AdminSections";

import { useLanguage } from "../i18n";

// Огляд: метрики, графіки, експорт звіту й нові користувачі.
export function AdminPage() {
  const { tr } = useLanguage();
  const report = useApi<AdminReport>("/admin/report");
  const latest = useApi<AdminUser[]>("/admin/users?limit=12");

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{tr("Панель адміністратора")}</h1>
          <p>{tr("Статистика всієї платформи, облікові записи та скарги.")}</p>
        </div>
        <ReportExport />
      </div>
      <ResourceState
        loading={report.loading}
        error={report.error}
        onRetry={report.refresh}
      />
      {report.data && (
        <>
          <AdminStats report={report.data} />
          <div className="admin-overview">
            <GrowthChart report={report.data} />
            <section className="chart-card admin-recent">
              <div className="admin-recent-heading">
                <h2>{tr("Нові користувачі")}</h2>
                <Link to="/admin/users">{tr("Усі")}</Link>
              </div>
              <ResourceState
                loading={latest.loading}
                error={latest.error}
                onRetry={latest.refresh}
              />
              <ul>
                {latest.data?.map((person) => (
                  <li key={person.id}>
                    <UserAvatar
                      name={person.name}
                      avatarUrl={person.avatarUrl}
                      size="small"
                    />
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.email}</small>
                    </span>
                    <small>{tr(roleNames[person.role])}</small>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <BreakdownCharts report={report.data} />
        </>
      )}
    </>
  );
}

// Таблиця користувачів: пошук і фільтри на сервері, зміна ролі/стану в діалозі.
export function AdminUsersPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const { params, page, search, set, reset } = useListParams();
  const role = allowedOrEmpty(params.get("role"), Object.keys(roleNames));
  const status = allowedOrEmpty(params.get("status"), ["ACTIVE", "BLOCKED"]);
  const [editing, setEditing] = useState<{
    user: AdminUser;
    action: UserAction;
  } | null>(null);
  const [creating, setCreating] = useState(false);

  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  const users = useApi<AdminUser[]>(`/admin/users?${query}`);

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: tr("Користувач"),
      sort: (row) => row.name,
      render: (row) => (
        <span className="admin-user-cell">
          <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="small" />
          <span>
            <strong>
              {row.name}
              {row.id === user?.id && tr(" (ви)")}
            </strong>
            <small>{row.email}</small>
          </span>
        </span>
      ),
    },
    {
      key: "role",
      label: tr("Роль"),
      sort: (row) => tr(roleNames[row.role]),
      render: (row) => tr(roleNames[row.role]),
    },
    {
      key: "status",
      label: tr("Стан"),
      sort: (row) => row.status,
      render: (row) => (
        <StatusPill
          status={row.status}
          label={tr(accountStatusNames[row.status])}
        />
      ),
    },
    {
      key: "createdAt",
      label: tr("Зареєстровано"),
      sort: (row) => row.createdAt,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      label: tr("Дії"),
      // Адміністраторів (і себе) панель не змінює
      render: (row) =>
        row.role === "ADMIN" ? (
          <span className="admin-protected">
            <i className="bi bi-shield-lock" aria-hidden="true"></i>
            {tr("Захищено")}
          </span>
        ) : (
          <span className="admin-row-actions">
            <button
              className="icon-action"
              aria-label={tr("Змінити роль {0}", row.name)}
              data-tip={tr("Змінити роль")}
              onClick={() => setEditing({ user: row, action: "role" })}
            >
              <i className="bi bi-person-gear" aria-hidden="true"></i>
            </button>
            <button
              className="icon-action"
              aria-label={
                row.status === "BLOCKED"
                  ? tr("Розблокувати {0}", row.name)
                  : tr("Заблокувати {0}", row.name)
              }
              data-tip={
                row.status === "BLOCKED"
                  ? tr("Розблокувати")
                  : tr("Заблокувати")
              }
              onClick={() => setEditing({ user: row, action: "status" })}
            >
              <i
                className={
                  row.status === "BLOCKED"
                    ? "bi bi-unlock"
                    : "bi bi-slash-circle"
                }
                aria-hidden="true"
              ></i>
            </button>
            <button
              className="icon-action danger"
              aria-label={tr("Видалити {0}", row.name)}
              data-tip={tr("Видалити")}
              onClick={() => setEditing({ user: row, action: "delete" })}
            >
              <i className="bi bi-trash3" aria-hidden="true"></i>
            </button>
          </span>
        ),
    },
  ];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{tr("Користувачі")}</h1>
          <p>{tr("Облікові записи платформи: роль і стан доступу.")}</p>
        </div>
        <button className="button primary" onClick={() => setCreating(true)}>
          <i className="bi bi-shield-plus" aria-hidden="true"></i>
          {tr("Новий адміністратор")}
        </button>
      </div>
      <section className="data-panel admin-panel">
        <ListToolbar
          search={search}
          placeholder={tr("Ім'я або email")}
          filtered={Boolean(search || role || status)}
          onSearch={(value) => set("search", value)}
          onReset={reset}
        >
          <FilterSelect
            label={tr("Роль")}
            value={role}
            onChange={(value) => set("role", value)}
          >
            <option value="">{tr("Усі ролі")}</option>
            <RoleOptions />
          </FilterSelect>
          <FilterSelect
            label={tr("Стан облікового запису")}
            value={status}
            onChange={(value) => set("status", value)}
          >
            <option value="">{tr("Усі стани")}</option>
            <AccountStatusOptions />
          </FilterSelect>
        </ListToolbar>
        <ResourceState
          loading={users.loading}
          error={users.error}
          onRetry={users.refresh}
        />
        {users.data && (
          <>
            <DataTable
              caption={tr("Користувачі")}
              columns={columns}
              rows={users.data}
              empty={
                search || role || status
                  ? tr("За цими умовами користувачів не знайдено.")
                  : tr("На цій сторінці користувачів не знайдено.")
              }
            />
            <Pagination
              page={page}
              count={users.data.length}
              onChange={(value) => set("page", String(value))}
            />
          </>
        )}
      </section>
      {editing && (
        <UserDialog
          user={editing.user}
          action={editing.action}
          onSaved={users.refresh}
          onClose={() => setEditing(null)}
        />
      )}
      {creating && (
        <AdminCreateDialog
          twoFactor={Boolean(user?.twoFactorEnabled)}
          onSaved={users.refresh}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
