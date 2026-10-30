import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { LoadError } from "../components/LoadError";
import { ReviewForm } from "../components/ReviewForm";
import { TaskSearchFilters } from "../components/TaskSearchFilters";
import { AddProjectMember } from "../components/AddProjectMember";
import { formatDate, parsePage } from "../format";
import {
  priorityNames,
  projectStatusNames,
  roleNames,
  taskStatusNames,
} from "../types";
import type { Project, ProjectMember, Task } from "../types";

import { useLanguage } from "../i18n";
export function ProjectDetailsPage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const search = params.get("search") || "";
  const assigneeId = params.get("assigneeId") || "";
  const overdue = params.get("overdue") === "true";
  const rawStatus = params.get("status") || "";
  const status = Object.hasOwn(taskStatusNames, rawStatus) ? rawStatus : "";
  const rawPriority = params.get("priority") || "";
  const priority = Object.hasOwn(priorityNames, rawPriority) ? rawPriority : "";
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [memberNotice, setMemberNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ page: String(page), limit: "10" });
        if (status) query.set("status", status);
        if (priority) query.set("priority", priority);
        if (search) query.set("search", search);
        if (assigneeId) query.set("assigneeId", assigneeId);
        if (overdue) query.set("overdue", "true");
        const [detail, people, items] = await Promise.all([
          request<Project>(`/projects/${id}`, { signal: controller.signal }),
          request<ProjectMember[]>(`/projects/${id}/members`, {
            signal: controller.signal,
          }),
          request<Task[]>(`/projects/${id}/tasks?${query}`, {
            signal: controller.signal,
          }),
        ]);
        if (active) {
          setProject(detail);
          setMembers(people);
          setTasks(items);
        }
      } catch (error) {
        if (active) setError(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, page, status, priority, search, assigneeId, overdue, attempt]);

  function changeFilter(name: string, value: string) {
    const query = new URLSearchParams(params);
    query.delete("page");
    if (value) query.set(name, value);
    else query.delete(name);
    setParams(query);
  }
  function changePage(value: number) {
    const query = new URLSearchParams(params);
    query.set("page", String(value));
    setParams(query);
  }
  const retry = () => setAttempt((value) => value + 1);
  if (loading)
    return (
      <div className="page-loading" role="status">
        {tr("Завантажуємо проєкт…")}
      </div>
    );
  if (error)
    return (
      <>
        <Link to="/projects">{tr("← До списку проєктів")}</Link>
        <LoadError message={error} onRetry={retry} />
      </>
    );
  if (!project || project.id !== id) return null;
  const canEdit =
    (user?.role === "ADMIN" || project.clientId === user?.id) &&
    !["COMPLETED", "CANCELLED"].includes(project.status);

  return (
    <>
      <Link className="breadcrumb" to="/projects">
        ←{" "}
        {user?.role === "FREELANCER" ? tr("Робочі проєкти") : tr("Мої проєкти")}
      </Link>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{project.title}</h1>
        </div>
        <div className="page-actions">
          {canEdit && (
            <Link className="button primary" to={`/projects/${id}/edit`}>
              <i className="bi bi-pencil" aria-hidden="true"></i>

              {tr("Редагувати проєкт")}
            </Link>
          )}
          {canEdit && (
            <Link className="button secondary" to={`/projects/${id}/tasks/new`}>
              <i className="bi bi-plus-lg" aria-hidden="true"></i>

              {tr("Створити завдання")}
            </Link>
          )}
          {canEdit && (
            <Link
              className="button secondary"
              to={`/projects/${id}/applications`}
            >
              {tr("Заявки")}
            </Link>
          )}
          <button className="button secondary" onClick={retry}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

            {tr("Оновити дані")}
          </button>
        </div>
      </div>
      <nav className="project-links" aria-label={tr("Розділи проєкту")}>
        <Link to={`/tasks?project=${id}`}>{tr("Усі завдання")}</Link>
        <Link to={`/messages?project=${id}`}>{tr("Повідомлення")}</Link>
        <Link to={`/projects/${id}/files`}>{tr("Файли")}</Link>
        <Link to={`/projects/${id}/orders`}>{tr("Замовлення")}</Link>
        <Link to={`/projects/${id}/board`}>Kanban</Link>
        <Link to={`/projects/${id}/milestones`}>{tr("Етапи")}</Link>
        <Link to={`/projects/${id}/activity`}>{tr("Історія")}</Link>
        <Link to={`/ai?project=${id}`}>{tr("Аналіз AI")}</Link>
        {canEdit && (
          <Link to={`/projects/${id}/plan`}>{tr("AI-планування")}</Link>
        )}
      </nav>
      <section
        className="data-panel project-overview"
        aria-label={tr("Огляд проєкту")}
      >
        <p className="project-full-description">
          {project.description || tr("Опис не додано.")}
        </p>
        <dl className="project-facts">
          <div>
            <dt>{tr("Статус")}</dt>
            <dd>
              <span className={`project-status status-${project.status}`}>
                {tr(projectStatusNames[project.status])}
              </span>
            </dd>
          </div>
          <div>
            <dt>{tr("Дедлайн")}</dt>
            <dd>{formatDate(project.deadline, true)}</dd>
          </div>
          <div>
            <dt>{tr("Фрилансери")}</dt>
            <dd>{members.length}</dd>
          </div>
          <div>
            <dt>
              {tr("Виконано")} {project.completedTasks} {tr("із")}{" "}
              {project.totalTasks} {tr("завдань")}
            </dt>
            <dd>
              <progress
                className="project-progress"
                max={100}
                value={project.progress}
                aria-label={tr("Прогрес проєкту")}
              />{" "}
              {project.progress}%
            </dd>
          </div>
        </dl>
      </section>
      <section
        className="data-panel projects-panel"
        aria-labelledby="project-tasks-heading"
      >
        <div className="panel-heading">
          <h2 id="project-tasks-heading">{tr("Завдання проєкту")}</h2>
          <div className="task-filters">
            <TaskSearchFilters
              search={search}
              assigneeId={assigneeId}
              overdue={overdue}
              members={members}
              onChange={changeFilter}
            />
            <div className="filter-field">
              <label htmlFor="task-status">{tr("Статус")}</label>
              <select
                id="task-status"
                value={status}
                onChange={(event) => changeFilter("status", event.target.value)}
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
              <label htmlFor="task-priority">{tr("Пріоритет")}</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(event) =>
                  changeFilter("priority", event.target.value)
                }
              >
                <option value="">{tr("Усі пріоритети")}</option>
                {Object.entries(priorityNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {tasks.length ? (
          <>
            <p className="table-hint">
              {tr("Гортайте таблицю вбік, щоб побачити всі стовпці.")}
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label={tr("Таблиця завдань")}
              tabIndex={0}
            >
              <table className="projects-table tasks-table">
                <thead>
                  <tr>
                    <th scope="col">{tr("Назва")}</th>
                    <th scope="col">{tr("Виконавець")}</th>
                    <th scope="col">{tr("Пріоритет")}</th>
                    <th scope="col">{tr("Статус")}</th>
                    <th scope="col">{tr("Дедлайн")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                      </td>
                      <td>
                        {task.assigneeId
                          ? members.find(
                              (member) => member.userId === task.assigneeId,
                            )?.user?.name || tr("Учасник недоступний")
                          : tr("Не призначено")}
                      </td>
                      <td>{tr(priorityNames[task.priority])}</td>
                      <td>{tr(taskStatusNames[task.status])}</td>
                      <td>{formatDate(task.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>{tr("Завдань не знайдено")}</h3>
            <p>{tr("На цій сторінці немає завдань із вибраними фільтрами.")}</p>
          </div>
        )}
        <nav className="pagination" aria-label={tr("Сторінки завдань")}>
          <span>
            {tr("Сторінка")} {page} {tr("· Показано:")} {tasks.length}{" "}
            {tr("· У проєкті:")} {project.totalTasks}
          </span>
          <div>
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => changePage(page - 1)}
            >
              {tr("← Попередня")}
            </button>
            <button
              className="button secondary"
              disabled={tasks.length < 10 || page === 10000}
              onClick={() => changePage(page + 1)}
            >
              {tr("Наступна →")}
            </button>
          </div>
        </nav>
      </section>
      <section
        className="data-panel projects-panel"
        aria-labelledby="project-members-heading"
      >
        <div className="panel-heading">
          <h2 id="project-members-heading">{tr("Учасники проєкту")}</h2>
        </div>
        {memberNotice && (
          <p className="notice success padded" role="status">
            {memberNotice}
          </p>
        )}
        {canEdit && project.status !== "PLANNING" && (
          <AddProjectMember
            projectId={project.id}
            members={members}
            onAdded={() => {
              setMemberNotice(tr("Фрилансера додано до команди."));
              retry();
            }}
          />
        )}
        {members.length ? (
          <ul className="project-members">
            {members.map((member) => (
              <li key={member.id}>
                <span>
                  <strong>
                    {member.user ? (
                      <Link to={`/freelancers/${member.user.id}`}>
                        {member.user.name}
                      </Link>
                    ) : (
                      tr("Користувач недоступний")
                    )}
                  </strong>
                  <small>{member.user?.email}</small>
                </span>
                <span>
                  {member.user
                    ? tr(roleNames[member.user.role])
                    : tr("Учасник")}
                </span>
                {project.status === "COMPLETED" &&
                  project.clientId === user?.id &&
                  member.user && (
                    <ReviewForm
                      projectId={project.id}
                      freelancerId={member.user.id}
                      freelancerName={member.user.name}
                    />
                  )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state compact">
            <p>
              {tr("Виконавця ще не обрано. Перейдіть до заявок фрилансерів.")}
            </p>
          </div>
        )}
      </section>
    </>
  );
}
