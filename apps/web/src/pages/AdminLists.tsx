// Таблиці проєктів і скарг адмінки.
import { useState } from "react";
import { Link } from "react-router";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { complaintStatusNames, projectStatusNames } from "../types";
import type { Project } from "../types";
import {
  ComplaintDialog,
  DataTable,
  FilterSelect,
  ListToolbar,
  StatusPill,
  allowedOrEmpty,
  complaintTarget,
  useListParams,
} from "./AdminSections";
import type { Column, ComplaintWithDetails } from "./AdminSections";

import { useLanguage } from "../i18n";

// Пошук у межах завантаженої сторінки: API проєктів і скарг фільтрує лише за статусом.
function matches(search: string, ...values: (string | null | undefined)[]) {
  const needle = search.toLocaleLowerCase();
  return values.some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function AdminProjectsPage() {
  const { tr } = useLanguage();
  const { params, page, search, set, reset } = useListParams();
  const status = allowedOrEmpty(
    params.get("status"),
    Object.keys(projectStatusNames),
  );
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) query.set("status", status);
  const projects = useApi<Project[]>(`/projects?${query}`);
  const rows =
    projects.data?.filter(
      (row) => !search || matches(search, row.title, row.description),
    ) ?? [];

  const columns: Column<Project>[] = [
    {
      key: "title",
      label: tr("Проєкт"),
      sort: (row) => row.title,
      render: (row) => (
        <span className="admin-title-cell">
          <strong>{row.title}</strong>
          {row.description && <small>{row.description}</small>}
        </span>
      ),
    },
    {
      key: "status",
      label: tr("Статус"),
      sort: (row) => row.status,
      render: (row) => (
        <StatusPill
          status={row.status}
          label={tr(projectStatusNames[row.status])}
        />
      ),
    },
    {
      key: "progress",
      label: tr("Прогрес"),
      sort: (row) => row.progress,
      render: (row) => (
        <span className="admin-progress">
          <span aria-hidden="true">
            <span style={{ width: `${row.progress}%` }} />
          </span>
          {row.progress}% · {row.completedTasks}/{row.totalTasks}
        </span>
      ),
    },
    {
      key: "deadline",
      label: tr("Дедлайн"),
      sort: (row) => row.deadline ?? "",
      render: (row) => formatDate(row.deadline),
    },
    {
      key: "actions",
      label: tr("Дії"),
      render: (row) => (
        <Link
          className="button secondary"
          to={`/projects/${row.id}`}
          aria-label={tr("Відкрити {0}", row.title)}
        >
          <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
          {tr("Відкрити")}
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{tr("Проєкти")}</h1>
          <p>{tr("Усі проєкти платформи з прогресом виконання.")}</p>
        </div>
      </div>
      <section className="data-panel admin-panel">
        <ListToolbar
          search={search}
          placeholder={tr("Назва проєкту")}
          filtered={Boolean(search || status)}
          onSearch={(value) => set("search", value)}
          onReset={reset}
        >
          <FilterSelect
            label={tr("Статус")}
            value={status}
            onChange={(value) => set("status", value)}
          >
            <option value="">{tr("Усі статуси")}</option>
            {Object.entries(projectStatusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </FilterSelect>
        </ListToolbar>
        <ResourceState
          loading={projects.loading}
          error={projects.error}
          onRetry={projects.refresh}
        />
        {projects.data && (
          <>
            <DataTable
              caption={tr("Проєкти")}
              columns={columns}
              rows={rows}
              empty={tr("Проєктів не знайдено.")}
            />
            <Pagination
              page={page}
              count={projects.data.length}
              onChange={(value) => set("page", String(value))}
            />
          </>
        )}
      </section>
    </>
  );
}

export function AdminComplaintsPage() {
  const { tr } = useLanguage();
  const { params, page, search, set, reset } = useListParams();
  const status = allowedOrEmpty(
    params.get("status"),
    Object.keys(complaintStatusNames),
  );
  const [open, setOpen] = useState<ComplaintWithDetails | null>(null);
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) query.set("status", status);
  const complaints = useApi<ComplaintWithDetails[]>(
    `/admin/complaints?${query}`,
  );
  const rows =
    complaints.data?.filter(
      (row) =>
        !search ||
        matches(
          search,
          row.reason,
          row.description,
          row.reporter?.name,
          complaintTarget(row),
        ),
    ) ?? [];

  const columns: Column<ComplaintWithDetails>[] = [
    {
      key: "reason",
      label: tr("Скарга"),
      sort: (row) => row.reason,
      render: (row) => (
        <span className="admin-title-cell">
          <strong>{row.reason}</strong>
          <small>{row.description}</small>
        </span>
      ),
    },
    {
      key: "people",
      label: tr("Автор → ціль"),
      sort: (row) => row.reporter?.name ?? "",
      render: (row) =>
        `${row.reporter?.name || tr("не вказано")} → ${
          complaintTarget(row) || tr("не вказано")
        }`,
    },
    {
      key: "status",
      label: tr("Статус"),
      sort: (row) => row.status,
      render: (row) => (
        <StatusPill
          status={row.status}
          label={tr(complaintStatusNames[row.status])}
        />
      ),
    },
    {
      key: "createdAt",
      label: tr("Створено"),
      sort: (row) => row.createdAt,
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      label: tr("Дії"),
      render: (row) => (
        <button
          className={
            row.status === "OPEN" ? "button primary" : "button secondary"
          }
          aria-label={tr("Розглянути {0}", row.reason)}
          onClick={() => setOpen(row)}
        >
          {row.status === "OPEN" ? tr("Розглянути") : tr("Деталі")}
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{tr("Модерація скарг")}</h1>
          <p>{tr("Рішення не блокує користувача автоматично.")}</p>
        </div>
      </div>
      <section className="data-panel admin-panel">
        <ListToolbar
          search={search}
          placeholder={tr("Причина, автор або ціль")}
          filtered={Boolean(search || status)}
          onSearch={(value) => set("search", value)}
          onReset={reset}
        >
          <FilterSelect
            label={tr("Статус")}
            value={status}
            onChange={(value) => set("status", value)}
          >
            <option value="">{tr("Усі статуси")}</option>
            {Object.entries(complaintStatusNames).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </FilterSelect>
        </ListToolbar>
        <ResourceState
          loading={complaints.loading}
          error={complaints.error}
          onRetry={complaints.refresh}
        />
        {complaints.data && (
          <>
            <DataTable
              caption={tr("Скарги")}
              columns={columns}
              rows={rows}
              empty={tr("Скарг не знайдено.")}
            />
            <Pagination
              page={page}
              count={complaints.data.length}
              onChange={(value) => set("page", String(value))}
            />
          </>
        )}
      </section>
      {open && (
        <ComplaintDialog
          complaint={open}
          onDecided={complaints.refresh}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
