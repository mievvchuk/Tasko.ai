import { useState } from "react";
import type { DragEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import { groupTasksByStatus, isOverdue, kanbanStatuses } from "../kanban";
import {
  priorityNames,
  taskStatusNames,
  type Task,
  type TaskStatus,
} from "../types";
import { useApi } from "../useApi";

// Сервер дозволяє вручну перемикати лише ці два статуси.
// «На перевірці» — це передавання результату, а «Завершено» ставить клієнт.
const movableStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS"];

export function ProjectBoardPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useApi<Task[]>(
    id ? `/projects/${id}/tasks?limit=50` : null,
  );
  const [actionError, setActionError] = useState("");
  // Яку картку тягнемо і над якою колонкою вона зараз
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  // Перетягувати можна лише своє завдання (або будь-яке — адміністратору)
  function canMove(task: Task) {
    const allowed = task.assigneeId === user?.id || user?.role === "ADMIN";
    return allowed && movableStatuses.includes(task.status);
  }

  async function change(taskId: string, status: TaskStatus) {
    setActionError("");
    try {
      await request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: { status },
      });
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  // Обробники drag-and-drop (вбудований HTML5 API, без бібліотек)
  function handleDragOver(event: DragEvent, status: TaskStatus) {
    if (!dragId || !movableStatuses.includes(status)) return;
    event.preventDefault(); // без цього браузер не дозволить «кинути» сюди
    setOverStatus(status);
  }
  function handleDrop(status: TaskStatus) {
    const task = data?.find((item) => item.id === dragId);
    if (task && task.status !== status) void change(task.id, status);
    stopDragging();
  }
  function stopDragging() {
    setDragId(null);
    setOverStatus(null);
  }

  // Клас колонки: під карткою — підсвічена, куди не можна кинути — бліда
  function columnClass(status: TaskStatus) {
    let className = `kanban-column column-${status}`;
    if (overStatus === status) className += " drop-target";
    if (dragId && !movableStatuses.includes(status)) className += " locked";
    return className;
  }

  const groups = groupTasksByStatus(data ?? []);
  const anyMovable = (data ?? []).some(canMove);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <h1>Дошка завдань</h1>
        <p>
          {anyMovable
            ? "Затисніть картку мишею й перетягніть між «До виконання» і «У процесі»."
            : "Статус завдання змінює призначений виконавець."}
        </p>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div className="kanban-board">
          {kanbanStatuses.map((status) => (
            <section
              key={status}
              className={columnClass(status)}
              onDragOver={(event) => handleDragOver(event, status)}
              onDragLeave={() => setOverStatus(null)}
              onDrop={() => handleDrop(status)}
            >
              <h2>
                {taskStatusNames[status]} <span>{groups[status].length}</span>
              </h2>
              {!groups[status].length && (
                <p className="kanban-empty">Порожньо</p>
              )}
              {groups[status].map((task) => {
                const movable = canMove(task);
                return (
                  <article
                    key={task.id}
                    className={
                      dragId === task.id
                        ? "kanban-card dragging"
                        : "kanban-card"
                    }
                    draggable={movable}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={stopDragging}
                  >
                    <div className="kanban-card-title">
                      <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                      {movable && (
                        <i
                          className="bi bi-grip-vertical"
                          aria-hidden="true"
                        ></i>
                      )}
                    </div>
                    <small>{task.description || "Без опису"}</small>
                    <div className="kanban-meta">
                      <span className={`priority priority-${task.priority}`}>
                        {priorityNames[task.priority]}
                      </span>
                      {task.deadline && (
                        <span
                          className={
                            isOverdue(task)
                              ? "kanban-deadline overdue"
                              : "kanban-deadline"
                          }
                        >
                          <i
                            className={
                              isOverdue(task)
                                ? "bi bi-clock-history"
                                : "bi bi-calendar3"
                            }
                            aria-hidden="true"
                          ></i>
                          {formatDate(task.deadline)}
                        </span>
                      )}
                    </div>
                    {/* select лишаємо — ним можна змінити статус з клавіатури */}
                    {movable && (
                      <select
                        aria-label={`Статус ${task.title}`}
                        value={task.status}
                        onChange={(e) =>
                          void change(task.id, e.target.value as TaskStatus)
                        }
                      >
                        <option value="TODO">До виконання</option>
                        <option value="IN_PROGRESS">У процесі</option>
                      </select>
                    )}
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
