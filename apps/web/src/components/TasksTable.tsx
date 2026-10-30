import { Link } from "react-router";
import { formatDate } from "../format";
import { isOverdue } from "../kanban";
import { priorityNames, taskStatusNames } from "../types";
import type { ProjectMember, Task } from "../types";

export function TasksTable({
  tasks,
  members,
}: {
  tasks: Task[];
  members: ProjectMember[];
}) {
  if (!tasks.length)
    return (
      <div className="empty-state">
        <h3>Завдань не знайдено</h3>
        <p>Змініть фільтри або створіть завдання.</p>
      </div>
    );
  return (
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
                <td>
                  <span className={`project-status status-${task.status}`}>
                    {taskStatusNames[task.status]}
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
