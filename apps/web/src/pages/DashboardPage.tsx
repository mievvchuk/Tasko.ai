import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { formatDate } from "../format";
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

interface DashboardData {
  summary: DashboardSummary;
  projects: Project[];
  deadlines: TaskDeadline[];
}

export function DashboardPage() {
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
          <span className="eyebrow">TASKO.AI / ГОЛОВНА</span>
          <h1>Головна панель</h1>
          <p>Ваші проєкти, завдання та терміни виконання — перед очима.</p>
        </div>
        <button
          className="button secondary"
          onClick={refresh}
          disabled={loading}
        >
          Оновити дані <span aria-hidden="true">↻</span>
        </button>
      </div>
      <section className="role-banner">
        <div>
          <strong>
            {user?.role === "CLIENT"
              ? "Ви керуєте власними проєктами"
              : user?.role === "FREELANCER"
                ? "Ви виконуєте проєкти, на які вас обрав клієнт"
                : "Ви контролюєте роботу сервісу"}
          </strong>
          <p>
            {user?.role === "CLIENT"
              ? "Опублікуйте проєкт, перегляньте заявки та оберіть виконавця."
              : user?.role === "FREELANCER"
                ? "Знайдіть відкритий проєкт на біржі та залиште свою пропозицію."
                : "Переглядайте проєкти, користувачів і аналітичний звіт."}
          </p>
        </div>
        {user?.role === "CLIENT" && (
          <Link className="button primary" to="/projects/new">
            Опублікувати проєкт
          </Link>
        )}
        {user?.role === "FREELANCER" && (
          <Link className="button primary" to="/marketplace">
            Перейти на біржу
          </Link>
        )}
      </section>
      {loading && (
        <div className="page-loading" role="status">
          <span className="loader" />
          Завантажуємо огляд…
        </div>
      )}
      {!loading && error && <LoadError message={error} onRetry={refresh} />}
      {!loading && !error && data && (
        <>
          <section className="stats-grid" aria-label="Статистика">
            <article className="stat-card">
              <span className="stat-label">Активні проєкти</span>
              <strong data-testid="active-projects">
                {data.summary.activeProjects}
              </strong>
              <span className="stat-note">
                Із {data.summary.projects} доступних проєктів
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">Усі завдання</span>
              <strong data-testid="total-tasks">{data.summary.tasks}</strong>
              <span className="stat-note">
                Завершено: {data.summary.completedTasks}
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-label">У процесі</span>
              <strong data-testid="in-progress-tasks">
                {data.summary.tasksByStatus.IN_PROGRESS}
              </strong>
              <span className="stat-note">Завдання у виконанні</span>
            </article>
            <article className="stat-card deadline-card">
              <span className="stat-label">Найближчий дедлайн</span>
              <strong className="stat-date">
                {data.summary.nearestDeadline
                  ? formatDate(data.summary.nearestDeadline)
                  : "—"}
              </strong>
              <span className="stat-note">
                Прострочених завдань: {data.summary.overdueTasks}
              </span>
            </article>
          </section>
          <section
            className="data-panel"
            aria-labelledby="active-projects-title"
          >
            <div className="panel-heading">
              <div>
                <h2 id="active-projects-title">Активні проєкти</h2>
                <p>Останні активні проєкти, до яких ви маєте доступ</p>
              </div>
              <Link className="text-link" to="/projects">
                Усі проєкти <span aria-hidden="true">↗</span>
              </Link>
            </div>
            {data.projects.length ? (
              <ProjectsTable projects={data.projects} />
            ) : (
              <div className="empty-state">
                <span className="empty-symbol" aria-hidden="true">
                  ▦
                </span>
                <h3>Активних проєктів поки немає</h3>
                <p>
                  Проєкти у плануванні та з іншими статусами доступні в
                  загальному списку.
                </p>
                <Link to="/projects" className="text-link">
                  Переглянути проєкти →
                </Link>
              </div>
            )}
          </section>
          <div className="dashboard-bottom">
            <section
              className="data-panel"
              aria-labelledby="task-statuses-title"
            >
              <div className="panel-heading">
                <div>
                  <h2 id="task-statuses-title">Завдання за статусом</h2>
                  <p>Розподіл усіх доступних завдань</p>
                </div>
              </div>
              {data.summary.tasks ? (
                <div className="task-status-list">
                  {(Object.keys(taskStatusNames) as TaskStatus[]).map(
                    (status) => (
                      <div className="task-status-row" key={status}>
                        <div>
                          <span>{taskStatusNames[status]}</span>
                          <strong>{data.summary.tasksByStatus[status]}</strong>
                        </div>
                        <progress
                          className={"status-progress progress-" + status}
                          max={data.summary.tasks}
                          value={data.summary.tasksByStatus[status]}
                          aria-label={taskStatusNames[status]}
                        />
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state compact">
                  <h3>Завдань поки немає</h3>
                  <p>
                    Статистика з'явиться після створення завдань у доступних
                    проєктах.
                  </p>
                </div>
              )}
            </section>
            <section className="data-panel" aria-labelledby="deadlines-title">
              <div className="panel-heading">
                <div>
                  <h2 id="deadlines-title">Дедлайни завдань</h2>
                  <p>Першими показано найраніші, включно з простроченими</p>
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
                        <span>
                          {taskStatusNames[task.status]} ·{" "}
                          {task.risk === "OVERDUE"
                            ? "Прострочено"
                            : formatDate(task.deadline, true)}
                        </span>
                        {task.risk === "OVERDUE" && (
                          <time dateTime={task.deadline}>
                            {formatDate(task.deadline, true)}
                          </time>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state compact">
                  <h3>Дедлайнів немає</h3>
                  <p>Немає незавершених завдань із визначеним терміном.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
