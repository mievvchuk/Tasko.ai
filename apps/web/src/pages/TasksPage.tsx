import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage } from "../format";
import { ProjectPicker } from "../components/ProjectPicker";
import { Pagination, ResourceState } from "../components/ResourceState";
import { TasksTable } from "../components/TasksTable";
import { TaskSearchFilters } from "../components/TaskSearchFilters";
import { priorityNames, taskStatusNames } from "../types";
import type { Project, ProjectMember, Task } from "../types";

export function TasksPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const page = parsePage(params.get("page"));
  const search = params.get("search") || "";
  const assigneeId = params.get("assigneeId") || "";
  const overdue = params.get("overdue") === "true";
  const status = Object.hasOwn(taskStatusNames, params.get("status") || "")
    ? params.get("status") || ""
    : "";
  const priority = Object.hasOwn(priorityNames, params.get("priority") || "")
    ? params.get("priority") || ""
    : "";
  const project = useApi<Project>(projectId ? `/projects/${projectId}` : null);
  const members = useApi<ProjectMember[]>(
    projectId ? `/projects/${projectId}/members` : null,
  );
  const query = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) query.set("status", status);
  if (priority) query.set("priority", priority);
  if (search) query.set("search", search);
  if (assigneeId) query.set("assigneeId", assigneeId);
  if (overdue) query.set("overdue", "true");
  const tasks = useApi<Task[]>(
    project.data ? `/projects/${projectId}/tasks?${query}` : null,
  );
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  const canCreate =
    project.data &&
    !["COMPLETED", "CANCELLED"].includes(project.data.status) &&
    (user?.role === "ADMIN" || project.data.clientId === user?.id);
  return (
    <>
      <div className="page-heading">
        <h1>Завдання</h1>
        <p>Оберіть проєкт, щоб переглянути та організувати роботу команди.</p>
      </div>
      <ProjectPicker
        value={projectId}
        selected={project.data}
        onChange={(value) => setParams(value ? { project: value } : {})}
      />
      <ResourceState
        loading={project.loading || members.loading}
        error={project.error || members.error}
        onRetry={() => {
          project.refresh();
          members.refresh();
        }}
      />
      {project.data && !members.error && !members.loading && (
        <section className="data-panel projects-panel">
          <div className="panel-heading">
            <div>
              <h2>{project.data.title}</h2>
              <Link to={`/projects/${projectId}`}>До проєкту</Link>
            </div>
            {canCreate && (
              <Link
                className="button primary"
                to={`/projects/${projectId}/tasks/new`}
              >
                <i className="bi bi-plus-lg" aria-hidden="true"></i>
                Створити завдання
              </Link>
            )}
          </div>
          <div className="task-filters padded">
            <TaskSearchFilters
              search={search}
              assigneeId={assigneeId}
              overdue={overdue}
              members={members.data || []}
              onChange={change}
            />
            <div className="filter-field">
              <label htmlFor="list-task-status">Статус</label>
              <select
                id="list-task-status"
                value={status}
                onChange={(event) => change("status", event.target.value)}
              >
                <option value="">Усі статуси</option>
                {Object.entries(taskStatusNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-field">
              <label htmlFor="list-task-priority">Пріоритет</label>
              <select
                id="list-task-priority"
                value={priority}
                onChange={(event) => change("priority", event.target.value)}
              >
                <option value="">Усі пріоритети</option>
                {Object.entries(priorityNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button className="button secondary" onClick={tasks.refresh}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
              Оновити
            </button>
          </div>
          <ResourceState
            loading={tasks.loading}
            error={tasks.error}
            onRetry={tasks.refresh}
          />
          {tasks.data && (
            <>
              <TasksTable tasks={tasks.data} members={members.data || []} />
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
      )}
    </>
  );
}
