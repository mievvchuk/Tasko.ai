import type { CSSProperties } from "react";
import { Link } from "react-router";
import { useApi } from "../useApi";
import { useAuth } from "../auth";
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
const overloadAt = 6;
function loadLevel(active: number) {
  if (active >= overloadAt) return { key: "high", label: "Перевантаження" };
  if (active >= 3) return { key: "medium", label: "Помірне навантаження" };
  return { key: "low", label: "Легке навантаження" };
}

// Кругова шкала навантаження: повне коло — 6 і більше незавершених завдань (перевантаження)
function LoadRing({ active, label }: { active: number; label: string }) {
  const { tr } = useLanguage();
  const percent = Math.min(100, (active / overloadAt) * 100);
  return (
    <div
      className="load-ring"
      role="img"
      aria-label={tr("{0}: незавершених завдань {1}", tr(label), active)}
      style={{ "--load-percent": `${percent}%` } as CSSProperties}
    >
      <strong>{active}</strong>
    </div>
  );
}

export function WorkloadPage() {
  const { tr } = useLanguage();
  const freelancer = useAuth().user?.role === "FREELANCER";
  const workload = useApi<FreelancerWorkload[]>("/analytics/workload");
  const people = workload.data || [];

  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>
            {freelancer ? tr("Графік роботи") : tr("Завантаженість виконавців")}
          </h1>
          <p>
            {freelancer
              ? tr(
                  "Незавершені завдання з усіх робочих проєктів — що здати першим і чи можна брати нове.",
                )
              : tr(
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
            {freelancer ? (
              <article className="stat-card">
                <span className="stat-label">{tr("Найближчий дедлайн")}</span>
                <strong className="stat-date">
                  {people[0]?.nearestDeadline
                    ? formatDate(people[0].nearestDeadline)
                    : "—"}
                </strong>
              </article>
            ) : (
              <article className="stat-card">
                <span className="stat-label">{tr("Виконавці")}</span>
                <strong>{people.length}</strong>
              </article>
            )}
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
          {!people.length && (
            <section className="data-panel empty-state">
              <h2>
                {freelancer
                  ? tr("Робочих завдань поки немає")
                  : tr("Виконавців поки немає")}
              </h2>
              <p>
                {freelancer
                  ? tr(
                      "Знайдіть проєкт на біржі — після найму завдання з'являться тут.",
                    )
                  : tr(
                      "Додайте команду до проєкту, щоб переглядати розподіл роботи.",
                    )}
              </p>
              <Link to={freelancer ? "/marketplace" : "/projects"}>
                {freelancer ? tr("Знайти роботу") : tr("Переглянути проєкти")}
              </Link>
            </section>
          )}
          {people.map((person, index) => {
            const level = loadLevel(person.activeTasks);
            return (
              <section
                className="data-panel workload-panel"
                key={person.user?.id || index}
              >
                <div
                  className={
                    freelancer ? "workload-head workload-self" : "workload-head"
                  }
                >
                  {freelancer ? (
                    <div className="workload-name">
                      <h2>{tr("Мої завдання")}</h2>
                      <span>
                        {person.activeTasks >= 6
                          ? tr("Завдань багато — нові заявки краще відкласти.")
                          : tr("Є місце для нового проєкту.")}
                      </span>
                    </div>
                  ) : (
                    <>
                      <UserAvatar
                        name={person.user?.name || "?"}
                        size="small"
                      />
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
                    </>
                  )}
                  <div className={"workload-load load-" + level.key}>
                    <LoadRing active={person.activeTasks} label={level.label} />
                    <div>
                      <b>{tr(level.label)}</b>
                      <dl className="workload-counts">
                        <div className="count-active">
                          <dt>{tr("Незавершені")}</dt>
                          <dd>{person.activeTasks}</dd>
                        </div>
                        <div className="count-overdue">
                          <dt>{tr("Прострочені")}</dt>
                          <dd>{person.overdueTasks}</dd>
                        </div>
                        <div className="count-priority">
                          <dt>{tr("Високий пріоритет")}</dt>
                          <dd>{person.highPriorityTasks}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
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
