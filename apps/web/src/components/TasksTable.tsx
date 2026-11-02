import { Link } from "react-router";
import { formatDate } from "../format";
import { isOverdue } from "../kanban";
import { priorityNames, taskStatusNames } from "../types";
import type { ProjectMember, Task } from "../types";

import { useLanguage } from "../i18n";
export function TasksTable({
  tasks,
  members,
}: {
  tasks: Task[];
  members: ProjectMember[];
}) {
  const { tr } = useLanguage();
  if (!tasks.length)
    return (
      <div className="empty-state">
        <h3>{tr("Завдань не знайдено")}</h3>
        <p>{tr("Змініть фільтри або створіть завдання.")}</p>
      </div>
    );
  return (
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
                <td>
                  <span className={`project-status status-${task.status}`}>
                    {tr(taskStatusNames[task.status])}
                  </span>
                </td>
                <td
                  className={
                    isOverdue(task) ? "deadline-cell overdue" : "deadline-cell"
                  }
                >
                  {task.deadline && (
                    <i
                      className={
                        isOverdue(task)
                          ? "bi bi-clock-history"
                          : "bi bi-calendar3"
                      }
                      aria-hidden="true"
                    ></i>
                  )}
                  {formatDate(task.deadline)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
