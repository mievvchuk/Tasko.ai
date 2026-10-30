import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { deadlineLabel, formatDate } from "../format";
import { LoadError } from "../components/LoadError";
import { ProjectsTable } from "../components/ProjectsTable";
import { useAuth } from "../auth";
import { taskStatusNames } from "../types";
import type {
  DashboardSummary,
  Project,
  TaskDeadline,
  TaskStatus,
} from "../types";

import { useLanguage } from "../i18n";
interface DashboardData {
  summary: DashboardSummary;
  projects: Project[];
  deadlines: TaskDeadline[];
}

export function DashboardPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const options = { signal: controller.signal };
        const [summary, projects, deadlines] = await Promise.all([
          request<DashboardSummary>("/analytics/dashboard", options),
          request<Project[]>("/projects?status=ACTIVE&limit=5", options),
          request<TaskDeadline[]>("/analytics/deadlines", options),
        ]);
        if (active) setData({ summary, projects, deadlines });
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
  }, [attempt]);

  const refresh = () => setAttempt((value) => value + 1);
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{tr("Головна панель")}</h1>
          <p>
            {tr("Ваші проєкти, завдання та терміни виконання — перед очима.")}
          </p>
        </div>
        <button
          className="button secondary"
          onClick={refresh}
          disabled={loading}
        >
          {tr("Оновити дані")} <span aria-hidden="true">↻</span>
        </button>
      </div>
      <section className="role-banner">
        <div>
          <strong>
            {user?.role === "CLIENT"
              ? tr("Ви керуєте власними проєктами")
              : user?.role === "FREELANCER"
                ? tr("Ви виконуєте проєкти, на які вас обрав клієнт")
                : tr("Ви контролюєте роботу сервісу")}
          </strong>
          <p>
            {user?.role === "CLIENT"
              ? tr(
                  "Опублікуйте проєкт, перегляньте заявки та оберіть виконавця.",
                )
              : user?.role === "FREELANCER"
                ? tr(
                    "Знайдіть відкритий проєкт на біржі та залиште свою пропозицію.",
                  )
                : tr("Переглядайте проєкти, користувачів і аналітичний звіт.")}
          </p>
        </div>
        {user?.role === "CLIENT" && (
          <Link className="button primary" to="/projects/new">
            {tr("Опублікувати проєкт")}
          </Link>
        )}
        {user?.role === "FREELANCER" && (
          <Link className="button primary" to="/marketplace">
            {tr("Перейти на біржу")}
          </Link>
        )}
      </section>
      {loading && (
        <div className="page-loading" role="status">
          <span className="loader" />

          {tr("Завантажуємо огляд…")}
        </div>
      )}
      {!loading && error && <LoadError message={error} onRetry={refresh} />}
      {!loading && !error && data && (
        <>
          <section className="stats-grid" aria-label={tr("Статистика")}>
            <Link className="stat-card" to="/projects?status=ACTIVE">
              <span className="stat-label">{tr("Активні проєкти")}</span>
              <strong data-testid="active-projects">
                {data.summary.activeProjects}
              </strong>
              <span className="stat-note">
                {tr("Із")} {data.summary.projects} {tr("доступних проєктів")}
              </span>
            </Link>
            <Link className="stat-card" to="/tasks">
              <span className="stat-label">{tr("Усі завдання")}</span>
              <strong data-testid="total-tasks">{data.summary.tasks}</strong>
              <span className="stat-note">
                {tr("Завершено:")} {data.summary.completedTasks}
              </span>
            </Link>
            <Link className="stat-card" to="/tasks?status=IN_PROGRESS">
              <span className="stat-label">{tr("У процесі")}</span>
              <strong data-testid="in-progress-tasks">
                {data.summary.tasksByStatus.IN_PROGRESS}
              </strong>
              <span className="stat-note">{tr("Завдання у виконанні")}</span>
            </Link>
            <Link className="stat-card deadline-card" to="/tasks?overdue=true">
              <span className="stat-label">{tr("Найближчий дедлайн")}</span>
              <strong className="stat-date">
                {data.summary.nearestDeadline
                  ? formatDate(data.summary.nearestDeadline)
                  : "—"}
              </strong>
              <span className="stat-note">
                {tr("Прострочених завдань:")} {data.summary.overdueTasks}
              </span>
            </Link>
          </section>
          <div className="dashboard-bottom">
            <section className="data-panel" aria-labelledby="deadlines-title">
              <div className="panel-heading">
                <div>
                  <h2 id="deadlines-title">{tr("Дедлайни завдань")}</h2>
                  <p>
                    {tr("Першими показано найраніші, включно з простроченими")}
                  </p>
                </div>
              </div>
              {data.deadlines.length ? (
                <ul className="deadline-list">
                  {data.deadlines.slice(0, 5).map((task) => (
                    <li key={task.id}>
                      <span
                        className={
                          task.risk === "OVERDUE"
                            ? "deadline-dot overdue"
                            : "deadline-dot"
                        }
                        aria-hidden="true"
                      />
                      <div>
                        <strong>
                          <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                        </strong>
                        <span>{tr(taskStatusNames[task.status])}</span>
                        <time dateTime={task.deadline}>
                          {formatDate(task.deadline, true)}
                        </time>
                      </div>
                      <span
                        className={
                          task.risk === "OVERDUE"
                            ? "days-left overdue"
                            : "days-left"
                        }
                      >
                        {deadlineLabel(task.deadline)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state compact">
                  <h3>{tr("Дедлайнів немає")}</h3>
                  <p>
                    {tr("Немає незавершених завдань із визначеним терміном.")}
                  </p>
                </div>
              )}
            </section>
            <section
              className="data-panel"
              aria-labelledby="task-statuses-title"
            >
              <div className="panel-heading">
                <div>
                  <h2 id="task-statuses-title">{tr("Завдання за статусом")}</h2>
                  <p>{tr("Розподіл усіх доступних завдань")}</p>
                </div>
              </div>
              {data.summary.tasks ? (
                <div className="task-status-list">
                  {(Object.keys(taskStatusNames) as TaskStatus[]).map(
                    (status) => (
                      <div className="task-status-row" key={status}>
                        <div>
                          <span>{tr(taskStatusNames[status])}</span>
                          <strong>{data.summary.tasksByStatus[status]}</strong>
                        </div>
                        <progress
                          className={"status-progress progress-" + status}
                          max={data.summary.tasks}
                          value={data.summary.tasksByStatus[status]}
                          aria-label={tr(taskStatusNames[status])}
                        />
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>{tr("Завдань поки немає")}</h3>
                  <p>
                    {tr(
                      "Статистика з'явиться після створення завдань у доступних проєктах.",
                    )}
                  </p>
                </div>
              )}
            </section>
          </div>
          <section
            className="data-panel"
            aria-labelledby="active-projects-title"
          >
            <div className="panel-heading">
              <div>
                <h2 id="active-projects-title">{tr("Активні проєкти")}</h2>
                <p>{tr("Останні активні проєкти, до яких ви маєте доступ")}</p>
              </div>
              <Link className="text-link" to="/projects">
                {tr("Усі проєкти")} <span aria-hidden="true">↗</span>
              </Link>
            </div>
            {data.projects.length ? (
              <ProjectsTable projects={data.projects} />
            ) : (
              <div className="empty-state">
                <i className="bi bi-inbox empty-symbol" aria-hidden="true"></i>
                <h3>{tr("Активних проєктів поки немає")}</h3>
                <p>
                  {tr(
                    "Проєкти у плануванні та з іншими статусами доступні в загальному списку.",
                  )}
                </p>
                <Link to="/projects" className="text-link">
                  {tr("Переглянути проєкти →")}
                </Link>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
