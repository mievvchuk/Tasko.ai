import { useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { roleNames } from "../types";
import type { AdminUser, AdminReport } from "../types";
import {
  AccountStatusOptions,
  AdminComplaints,
  AdminReportSummary,
  AdminUserCard,
  RoleOptions,
} from "./AdminSections";

export function AdminPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === "ADMIN";
  // Фільтри беремо з адресного рядка, але лише допустимі значення.
  const page = parsePage(params.get("page"));
  const role = allowedOrEmpty(params.get("role"), Object.keys(roleNames));
  const status = allowedOrEmpty(params.get("status"), ["ACTIVE", "BLOCKED"]);

  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  const users = useApi<AdminUser[]>(isAdmin ? `/admin/users?${query}` : null);
  const report = useApi<AdminReport>(isAdmin ? "/admin/report" : null);

  function refreshAll() {
    users.refresh();
    report.refresh();
  }

  // Зміна фільтра повертає на першу сторінку списку.
  function changeFilter(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }

  function changePage(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    setParams(next);
  }

  if (!user || !isAdmin)
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
      {report.data && <AdminReportSummary report={report.data} />}
      <section className="data-panel">
        <div className="panel-heading">
          <h2>Користувачі</h2>
          <button className="button secondary" onClick={refreshAll}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            Оновити дані
          </button>
        </div>
        <div className="task-filters padded">
          <div className="filter-field">
            <label htmlFor="admin-role-filter">Роль</label>
            <select
              id="admin-role-filter"
              value={role}
              onChange={(event) => changeFilter("role", event.target.value)}
            >
              <option value="">Усі ролі</option>
              <RoleOptions />
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="admin-status-filter">Стан облікового запису</label>
            <select
              id="admin-status-filter"
              value={status}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">Усі стани</option>
              <AccountStatusOptions />
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
                <AdminUserCard
                  // Нова роль або стан у key скидає форму після збереження.
                  key={`${person.id}-${person.role}-${person.status}`}
                  user={person}
                  self={person.id === user.id}
                  onSaved={refreshAll}
                />
              ))}
            </div>
            <Pagination
              page={page}
              count={users.data.length}
              onChange={changePage}
            />
          </>
        )}
      </section>
      <AdminComplaints />
    </>
  );
}

// Повертає значення, якщо воно є серед дозволених, інакше порожній рядок.
function allowedOrEmpty(value: string | null, allowed: string[]) {
  return value && allowed.includes(value) ? value : "";
}
