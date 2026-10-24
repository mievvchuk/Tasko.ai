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

export function ProjectDetailsPage() {
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
        Завантажуємо проєкт…
      </div>
    );
  if (error)
    return (
      <>
        <Link to="/projects">← До списку проєктів</Link>
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
        ← {user?.role === "FREELANCER" ? "Робочі проєкти" : "Мої проєкти"}
      </Link>
      <div className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">TASKO.AI / ПРОЄКТ</span>
          <h1>{project.title}</h1>
        </div>
        <div className="page-actions">
          {canEdit && (
            <Link className="button primary" to={`/projects/${id}/edit`}>
              <i className="bi bi-pencil" aria-hidden="true"></i>
              Редагувати проєкт
            </Link>
          )}
          {canEdit && (
            <Link className="button secondary" to={`/projects/${id}/tasks/new`}>
              <i className="bi bi-plus-lg" aria-hidden="true"></i>
              Створити завдання
            </Link>
          )}
          {canEdit && (
            <Link
              className="button secondary"
              to={`/projects/${id}/applications`}
            >
              Заявки
            </Link>
          )}
          <button className="button secondary" onClick={retry}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            Оновити дані
          </button>
        </div>
      </div>
      <nav className="project-links" aria-label="Розділи проєкту">
        <Link to={`/tasks?project=${id}`}>Усі завдання</Link>
        <Link to={`/messages?project=${id}`}>Повідомлення</Link>
        <Link to={`/projects/${id}/files`}>Файли</Link>
        <Link to={`/projects/${id}/orders`}>Замовлення</Link>
        <Link to={`/projects/${id}/board`}>Kanban</Link>
        <Link to={`/projects/${id}/milestones`}>Етапи</Link>
        <Link to={`/projects/${id}/activity`}>Історія</Link>
        <Link to={`/ai?project=${id}`}>Аналіз AI</Link>
        {canEdit && <Link to={`/projects/${id}/plan`}>AI-планування</Link>}
      </nav>
      <section
        className="data-panel project-overview"
        aria-label="Огляд проєкту"
      >
        <p className="project-full-description">
          {project.description || "Опис не додано."}
        </p>
        <dl className="project-facts">
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={`project-status status-${project.status}`}>
                {projectStatusNames[project.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt>Дедлайн</dt>
            <dd>{formatDate(project.deadline, true)}</dd>
          </div>
          <div>
            <dt>Фрилансери</dt>
            <dd>{members.length}</dd>
          </div>
          <div>
            <dt>
              Виконано {project.completedTasks} із {project.totalTasks} завдань
            </dt>
            <dd>
              <progress
                className="project-progress"
                max={100}
                value={project.progress}
                aria-label="Прогрес проєкту"
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
          <h2 id="project-tasks-heading">Завдання проєкту</h2>
          <div className="task-filters">
            <TaskSearchFilters
              search={search}
              assigneeId={assigneeId}
              overdue={overdue}
              members={members}
              onChange={changeFilter}
            />
            <div className="filter-field">
              <label htmlFor="task-status">Статус</label>
              <select
                id="task-status"
                value={status}
                onChange={(event) => changeFilter("status", event.target.value)}
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
              <label htmlFor="task-priority">Пріоритет</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(event) =>
                  changeFilter("priority", event.target.value)
                }
              >
                <option value="">Усі пріоритети</option>
                {Object.entries(priorityNames).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {tasks.length ? (
          <>
            <p className="table-hint">
              Гортайте таблицю вбік, щоб побачити всі стовпці.
            </p>
            <div
              className="table-scroll"
              role="region"
              aria-label="Таблиця завдань"
              tabIndex={0}
            >
              <table className="projects-table tasks-table">
                <thead>
                  <tr>
                    <th scope="col">Назва</th>
                    <th scope="col">Виконавець</th>
                    <th scope="col">Пріоритет</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Дедлайн</th>
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
                            )?.user?.name || "Учасник недоступний"
                          : "Не призначено"}
                      </td>
                      <td>{priorityNames[task.priority]}</td>
                      <td>{taskStatusNames[task.status]}</td>
                      <td>{formatDate(task.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>Завдань не знайдено</h3>
            <p>На цій сторінці немає завдань із вибраними фільтрами.</p>
          </div>
        )}
        <nav className="pagination" aria-label="Сторінки завдань">
          <span>
            Сторінка {page} · Показано: {tasks.length} · У проєкті:{" "}
            {project.totalTasks}
          </span>
          <div>
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => changePage(page - 1)}
            >
              ← Попередня
            </button>
            <button
              className="button secondary"
              disabled={tasks.length < 10 || page === 10000}
              onClick={() => changePage(page + 1)}
            >
              Наступна →
            </button>
          </div>
        </nav>
      </section>
      <section
        className="data-panel projects-panel"
        aria-labelledby="project-members-heading"
      >
        <div className="panel-heading">
          <h2 id="project-members-heading">Учасники проєкту</h2>
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
              setMemberNotice("Фрилансера додано до команди.");
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
                      "Користувач недоступний"
                    )}
                  </strong>
                  <small>{member.user?.email}</small>
                </span>
                <span>
                  {member.user ? roleNames[member.user.role] : "Учасник"}
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
            <p>Виконавця ще не обрано. Перейдіть до заявок фрилансерів.</p>
          </div>
        )}
      </section>
    </>
  );
}
