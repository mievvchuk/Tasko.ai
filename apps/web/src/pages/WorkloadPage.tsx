import { Link } from "react-router";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { priorityNames, taskStatusNames } from "../types";
import type { FreelancerWorkload } from "../types";

import { useLanguage } from "../i18n";
const riskNames = {
  NONE: "Без ризику",
  OVERDUE: "Прострочено",
  NEAR_DEADLINE: "Дедлайн наближається",
  HIGH_PRIORITY: "Високий пріоритет",
};

// Рівень навантаження за кількістю незавершених завдань
function loadLevel(active: number) {
  if (active >= 6)
    return { key: "high", label: "Перевантаження", percent: 100 };
  if (active >= 3)
    return {
      key: "medium",
      label: "Помірне навантаження",
      percent: 30 + active * 10,
    };
  return {
    key: "low",
    label: "Легке навантаження",
    percent: Math.max(8, active * 15),
  };
}

export function WorkloadPage() {
  const { tr } = useLanguage();
  const workload = useApi<FreelancerWorkload[]>("/analytics/workload");
  const people = workload.data || [];

  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{tr("Завантаженість виконавців")}</h1>
          <p>
            {tr(
              "Незавершені завдання, пріоритети та строки у доступних вам проєктах.",
            )}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={workload.loading}
          onClick={workload.refresh}
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

          {tr("Оновити дані")}
        </button>
      </div>
      <ResourceState
        loading={workload.loading}
        error={workload.error}
        onRetry={workload.refresh}
      />
      {workload.data && (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span className="stat-label">{tr("Виконавці")}</span>
              <strong>{people.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">{tr("Незавершені завдання")}</span>
              <strong>
                {people.reduce((sum, person) => sum + person.activeTasks, 0)}
              </strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">{tr("Прострочені")}</span>
              <strong>
                {people.reduce((sum, person) => sum + person.overdueTasks, 0)}
              </strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">{tr("Високий пріоритет")}</span>
              <strong>
                {people.reduce(
                  (sum, person) => sum + person.highPriorityTasks,
                  0,
                )}
              </strong>
            </article>
          </div>
          <p className="form-note">
            {tr(
              "Показники враховують лише доступні вам дані. Вони не розкривають роботу фрілансера у чужих приватних проєктах.",
            )}
          </p>
          {!people.length && (
            <section className="data-panel empty-state">
              <h2>{tr("Виконавців поки немає")}</h2>
              <p>
                {tr(
                  "Додайте команду до проєкту, щоб переглядати розподіл роботи.",
                )}
              </p>
              <Link to="/projects">{tr("Переглянути проєкти")}</Link>
            </section>
          )}
          {people.map((person, index) => {
            const level = loadLevel(person.activeTasks);
            return (
              <section
                className="data-panel workload-panel"
                key={person.user?.id || index}
              >
                <div className="workload-head">
                  <UserAvatar name={person.user?.name || "?"} size="small" />
                  <div className="workload-name">
                    <h2>
                      {person.user ? (
                        <Link to={`/freelancers/${person.user.id}`}>
                          {person.user.name}
                        </Link>
                      ) : (
                        tr("Користувач недоступний")
                      )}
                    </h2>
                    <span>
                      {tr("Перший дедлайн:")}{" "}
                      {formatDate(person.nearestDeadline, true)}
                    </span>
                  </div>
                  <div className={"load-meter load-" + level.key}>
                    <span>
                      <b>{tr(level.label)}</b>
                      {person.activeTasks}
                    </span>
                    <i aria-hidden="true">
                      <em style={{ width: `${level.percent}%` }}></em>
                    </i>
                  </div>
                </div>
                <ul className="workload-chips">
                  <li className="chip-active">
                    <strong>{person.activeTasks}</strong> {tr("Незавершені")}
                  </li>
                  <li className="chip-overdue">
                    <strong>{person.overdueTasks}</strong> {tr("Прострочені")}
                  </li>
                  <li className="chip-priority">
                    <strong>{person.highPriorityTasks}</strong>{" "}
                    {tr("Високий пріоритет")}
                  </li>
                </ul>
                {person.tasks.length ? (
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label={tr(
                      "Завдання {0}",
                      person.user?.name || "виконавця",
                    )}
                    tabIndex={0}
                  >
                    <table className="projects-table tasks-table">
                      <thead>
                        <tr>
                          <th scope="col">{tr("Завдання")}</th>
                          <th scope="col">{tr("Пріоритет")}</th>
                          <th scope="col">{tr("Статус")}</th>
                          <th scope="col">{tr("Дедлайн")}</th>
                          <th scope="col">{tr("Увага")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {person.tasks.map((task) => (
                          <tr key={task.id}>
                            <td>
                              <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                            </td>
                            <td>{tr(priorityNames[task.priority])}</td>
                            <td>{tr(taskStatusNames[task.status])}</td>
                            <td>{formatDate(task.deadline, true)}</td>
                            <td>
                              <span className={"risk-pill risk-" + task.risk}>
                                {tr(riskNames[task.risk])}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="padded form-note">
                    {tr("Незавершених завдань немає.")}
                  </p>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
