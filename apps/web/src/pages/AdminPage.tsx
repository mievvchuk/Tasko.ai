import type { FormEvent } from "react";
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

import { useLanguage } from "../i18n";
export function AdminPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = user?.role === "ADMIN";
  // Фільтри беремо з адресного рядка, але лише допустимі значення.
  const page = parsePage(params.get("page"));
  const role = allowedOrEmpty(params.get("role"), Object.keys(roleNames));
  const status = allowedOrEmpty(params.get("status"), ["ACTIVE", "BLOCKED"]);
  const search = (params.get("search") ?? "").slice(0, 100);

  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  if (search) query.set("search", search);
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    changeFilter("search", String(data.get("search") || "").trim());
  }

  function changePage(value: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(value));
    setParams(next);
  }

  if (!user || !isAdmin)
    return (
      <section className="account-panel">
        <h1>{tr("Доступ заборонено")}</h1>
        <p>{tr("Ця сторінка доступна лише адміністратору.")}</p>
      </section>
    );

  return (
    <>
      <div className="page-heading">
        <h1>{tr("Панель адміністратора")}</h1>
        <p>{tr("Статистика всієї платформи, облікові записи та скарги.")}</p>
      </div>
      <ResourceState
        loading={report.loading}
        error={report.error}
        onRetry={report.refresh}
      />
      {report.data && <AdminReportSummary report={report.data} />}
      <section className="data-panel">
        <div className="panel-heading">
          <h2>{tr("Користувачі")}</h2>
          <button className="button secondary" onClick={refreshAll}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

            {tr("Оновити дані")}
          </button>
        </div>
        <div className="task-filters padded">
          <form className="task-search" onSubmit={submitSearch}>
            <label htmlFor="admin-user-search">{tr("Пошук користувача")}</label>
            <div>
              <input
                key={search}
                id="admin-user-search"
                name="search"
                type="search"
                maxLength={100}
                defaultValue={search}
                placeholder={tr("Ім'я або email")}
              />
              <button className="button secondary" type="submit">
                {tr("Знайти")}
              </button>
            </div>
          </form>
          <div className="filter-field">
            <label htmlFor="admin-role-filter">{tr("Роль")}</label>
            <select
              id="admin-role-filter"
              value={role}
              onChange={(event) => changeFilter("role", event.target.value)}
            >
              <option value="">{tr("Усі ролі")}</option>
              <RoleOptions />
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="admin-status-filter">
              {tr("Стан облікового запису")}
            </label>
            <select
              id="admin-status-filter"
              value={status}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">{tr("Усі стани")}</option>
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
                  {search || role || status
                    ? tr("За цими умовами користувачів не знайдено.")
                    : tr("На цій сторінці користувачів не знайдено.")}
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
