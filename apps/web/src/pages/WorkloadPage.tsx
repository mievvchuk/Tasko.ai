import { Link } from "react-router";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
import { priorityNames, taskStatusNames } from "../types";
import type { FreelancerWorkload } from "../types";

const riskNames = {
  NONE: "Без ризику",
  OVERDUE: "Прострочено",
  NEAR_DEADLINE: "Дедлайн наближається",
  HIGH_PRIORITY: "Високий пріоритет",
};

export function WorkloadPage() {
  const workload = useApi<FreelancerWorkload[]>("/analytics/workload");
  const people = workload.data || [];

  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">TASKO.AI / КОМАНДА</span>
          <h1>Завантаженість виконавців</h1>
          <p>
            Незавершені завдання, пріоритети та строки у доступних вам проєктах.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={workload.loading}
          onClick={workload.refresh}
        >
          Оновити дані
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
              <span className="stat-label">Виконавці</span>
              <strong>{people.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Незавершені завдання</span>
              <strong>
                {people.reduce((sum, person) => sum + person.activeTasks, 0)}
              </strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Прострочені</span>
              <strong>
                {people.reduce((sum, person) => sum + person.overdueTasks, 0)}
              </strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Високий пріоритет</span>
              <strong>
                {people.reduce(
                  (sum, person) => sum + person.highPriorityTasks,
                  0,
                )}
              </strong>
            </article>
          </div>
          <p className="form-note">
            Показники враховують лише доступні вам дані. Вони не розкривають
            роботу фрилансера у чужих приватних проєктах.
          </p>
          {!people.length && (
            <section className="data-panel empty-state">
              <h2>Виконавців поки немає</h2>
              <p>
                Додайте команду до проєкту, щоб переглядати розподіл роботи.
              </p>
              <Link to="/projects">Переглянути проєкти</Link>
            </section>
          )}
          {people.map((person, index) => (
            <section
              className="data-panel workload-panel"
              key={person.user?.id || index}
            >
              <div className="panel-heading">
                <div>
                  <h2>
                    {person.user ? (
                      <Link to={`/freelancers/${person.user.id}`}>
                        {person.user.name}
                      </Link>
                    ) : (
                      "Користувач недоступний"
                    )}
                  </h2>
                  <p>
                    Незавершені: {person.activeTasks} · Прострочені:{" "}
                    {person.overdueTasks} · Високий пріоритет:{" "}
                    {person.highPriorityTasks}
                  </p>
                </div>
                <span>
                  Перший дедлайн: {formatDate(person.nearestDeadline, true)}
                </span>
              </div>
              {person.tasks.length ? (
                <div
                  className="table-scroll"
                  role="region"
                  aria-label={`Завдання ${person.user?.name || "виконавця"}`}
                  tabIndex={0}
                >
                  <table className="projects-table tasks-table">
                    <thead>
                      <tr>
                        <th scope="col">Завдання</th>
                        <th scope="col">Пріоритет</th>
                        <th scope="col">Статус</th>
                        <th scope="col">Дедлайн</th>
                        <th scope="col">Увага</th>
                      </tr>
                    </thead>
                    <tbody>
                      {person.tasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                          </td>
                          <td>{priorityNames[task.priority]}</td>
                          <td>{taskStatusNames[task.status]}</td>
                          <td>{formatDate(task.deadline, true)}</td>
                          <td>{riskNames[task.risk]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="padded form-note">Незавершених завдань немає.</p>
              )}
            </section>
          ))}
        </>
      )}
    </>
  );
}
