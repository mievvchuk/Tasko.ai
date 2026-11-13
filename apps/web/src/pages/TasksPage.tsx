import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { TasksTable } from "../components/TasksTable";
import { TaskSearchFilters } from "../components/TaskSearchFilters";
import { priorityNames, taskStatusNames } from "../types";
import type { Project, Task } from "../types";

import { useLanguage } from "../i18n";

// Усі завдання з усіх проєктів одразу; проєкт — лише фільтр, а не обов'язковий перший крок
export function TasksPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const page = parsePage(params.get("page"));
  const search = params.get("search") || "";
  const overdue = params.get("overdue") === "true";
  const status = Object.hasOwn(taskStatusNames, params.get("status") || "")
    ? params.get("status") || ""
    : "";
  const priority = Object.hasOwn(priorityNames, params.get("priority") || "")
    ? params.get("priority") || ""
    : "";
  // shortcut: у списку фільтра до 50 проєктів (ліміт API); більше — потрібен пошук у полі
  const projects = useApi<Project[]>("/projects?limit=50");
  const project = projects.data?.find((item) => item.id === projectId);
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (projectId) query.set("projectId", projectId);
  if (status) query.set("status", status);
  if (priority) query.set("priority", priority);
  if (search) query.set("search", search);
  if (overdue) query.set("overdue", "true");
  const tasks = useApi<Task[]>(`/tasks?${query}`);
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  const canCreate =
    project &&
    !["COMPLETED", "CANCELLED"].includes(project.status) &&
    project.clientId === user?.id;
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{tr("Завдання")}</h1>
          <p>
            {tr(
              "Завдання з усіх ваших проєктів в одному списку. Щоб звузити, оберіть проєкт або статус.",
            )}
          </p>
        </div>
        {project && (
          <div className="heading-actions">
            <Link
              className="button secondary"
              to={`/projects/${projectId}/board`}
            >
              <i className="bi bi-kanban" aria-hidden="true"></i>
              {tr("Дошка")}
            </Link>
            {canCreate && (
              <Link
                className="button primary"
                to={`/projects/${projectId}/tasks/new`}
              >
                <i className="bi bi-plus-lg" aria-hidden="true"></i>
                {tr("Створити завдання")}
              </Link>
            )}
          </div>
        )}
      </div>
      <section className="data-panel projects-panel">
        <div className="task-filters padded">
          <div className="filter-field">
            <label htmlFor="list-task-project">{tr("Проєкт")}</label>
            <select
              id="list-task-project"
              value={projectId}
              onChange={(event) => change("project", event.target.value)}
            >
              <option value="">{tr("Усі проєкти")}</option>
              {projects.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
          <TaskSearchFilters
            search={search}
            overdue={overdue}
            onChange={change}
          />
          <div className="filter-field">
            <label htmlFor="list-task-status">{tr("Статус")}</label>
            <select
              id="list-task-status"
              value={status}
              onChange={(event) => change("status", event.target.value)}
            >
              <option value="">{tr("Усі статуси")}</option>
              {Object.entries(taskStatusNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor="list-task-priority">{tr("Пріоритет")}</label>
            <select
              id="list-task-priority"
              value={priority}
              onChange={(event) => change("priority", event.target.value)}
            >
              <option value="">{tr("Усі пріоритети")}</option>
              {Object.entries(priorityNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              ))}
            </select>
          </div>
          <button className="button secondary" onClick={tasks.refresh}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            {tr("Оновити")}
          </button>
        </div>
        <ResourceState
          loading={tasks.loading}
          error={tasks.error}
          onRetry={tasks.refresh}
        />
        {tasks.data && (
          <>
            <TasksTable tasks={tasks.data} showProject={!projectId} />
            <Pagination
              page={page}
              count={tasks.data.length}
              onChange={(value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
