import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { deadlineLabel, formatDate } from "../format";
import { LoadError } from "../components/LoadError";
import { ProjectsTable } from "../components/ProjectsTable";
import { useAuth } from "../auth";
import { projectStatusNames, taskStatusNames } from "../types";
import { DonutChart, ProgressRing, StatusColumns } from "../components/Charts";
import type { ChartTone } from "../components/Charts";
import type {
  DashboardSummary,
  Project,
  ProjectStatus,
  TaskDeadline,
  TaskStatus,
} from "../types";

import { useLanguage } from "../i18n";
interface DashboardData {
  summary: DashboardSummary;
  projects: Project[];
  deadlines: TaskDeadline[];
}

const taskTones: Record<TaskStatus, ChartTone> = {
  TODO: "muted",
  IN_PROGRESS: "primary",
  REVIEW: "accent",
  DONE: "success",
};
const projectTones: Record<ProjectStatus, ChartTone> = {
  MODERATION: "accent",
  REJECTED: "danger",
  PLANNING: "muted",
  ACTIVE: "primary",
  PAUSED: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};

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
              <ProgressRing
                value={data.summary.activeProjects}
                max={data.summary.projects}
                tone="primary"
                label={tr("Активні проєкти")}
              />
            </Link>
            <Link className="stat-card" to="/tasks">
              <span className="stat-label">{tr("Усі завдання")}</span>
              <strong data-testid="total-tasks">{data.summary.tasks}</strong>
              <span className="stat-note">
                {tr("Завершено:")} {data.summary.completedTasks}
              </span>
              <ProgressRing
                value={data.summary.completedTasks}
                max={data.summary.tasks}
                label={tr("Завершено:")}
              />
            </Link>
            <Link className="stat-card" to="/tasks?status=IN_PROGRESS">
              <span className="stat-label">{tr("У процесі")}</span>
              <strong data-testid="in-progress-tasks">
                {data.summary.tasksByStatus.IN_PROGRESS}
              </strong>
              <span className="stat-note">{tr("Завдання у виконанні")}</span>
              <ProgressRing
                value={data.summary.tasksByStatus.IN_PROGRESS}
                max={data.summary.tasks}
                tone="primary"
                label={tr("У процесі")}
              />
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
              <ProgressRing
                value={data.summary.overdueTasks}
                max={data.summary.tasks - data.summary.completedTasks}
                tone="danger"
                label={tr("Прострочених завдань:")}
              />
            </Link>
          </section>
          <div className="dashboard-bottom dashboard-charts">
            <StatusColumns
              title={tr("Завдання за статусом")}
              items={(Object.keys(taskStatusNames) as TaskStatus[]).map(
                (status) => ({
                  label: tr(taskStatusNames[status]),
                  value: data.summary.tasksByStatus[status],
                  tone: taskTones[status],
                  to: `/tasks?status=${status}`,
                }),
              )}
            />
            <DonutChart
              title={tr("Проєкти за статусом")}
              center={String(data.summary.projects)}
              centerNote={tr("проєктів")}
              items={(Object.keys(projectStatusNames) as ProjectStatus[])
                .filter((status) => data.summary.projectsByStatus?.[status])
                .map((status) => ({
                  label: tr(projectStatusNames[status]),
                  value: data.summary.projectsByStatus[status],
                  tone: projectTones[status],
                  to: `/projects?status=${status}`,
                }))}
            />
            <section
              className="data-panel deadlines-panel"
              aria-labelledby="deadlines-title"
            >
              <div className="panel-heading">
                <h2 id="deadlines-title">{tr("Найближчі дедлайни")}</h2>
                <Link className="text-link" to="/tasks?overdue=true">
                  {tr("Прострочені")}: {data.summary.overdueTasks}
                </Link>
              </div>
              {data.deadlines.length ? (
                <ul className="deadline-list">
                  {data.deadlines.slice(0, 20).map((task) => (
                    <li key={task.id}>
                      <div>
                        <strong>
                          <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                        </strong>
                        <span>
                          {task.projectTitle} ·{" "}
                          {tr(taskStatusNames[task.status])}
                        </span>
                      </div>
                      <span
                        className={
                          task.risk === "OVERDUE"
                            ? "days-left overdue"
                            : "days-left"
                        }
                        title={formatDate(task.deadline, true)}
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
