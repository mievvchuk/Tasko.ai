import { useState } from "react";
import type { DragEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { groupTasksByStatus, kanbanStatuses } from "../kanban";
import { taskStatusNames, type Task, type TaskStatus } from "../types";
import { useApi } from "../useApi";

// Як і раніше через select, перетягувати можна лише між цими статусами
const movableStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS"];

export function ProjectBoardPage() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<Task[]>(
    id ? `/projects/${id}/tasks?limit=50` : null,
  );
  const [actionError, setActionError] = useState("");
  // НОВЕ: яку картку тягнемо і над якою колонкою вона зараз
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

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

  // НОВЕ: обробники drag-and-drop (вбудований HTML5 API, без бібліотек)
  function handleDragOver(event: DragEvent, status: TaskStatus) {
    if (!dragId || !movableStatuses.includes(status)) return;
    event.preventDefault(); // без цього браузер не дозволить «кинути» сюди
    setOverStatus(status);
  }
  function handleDrop(status: TaskStatus) {
    const task = data?.find((item) => item.id === dragId);
    if (task && task.status !== status) void change(task.id, status);
    setDragId(null);
    setOverStatus(null);
  }

  const groups = groupTasksByStatus(data ?? []);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / KANBAN</span>
        <h1>Дошка завдань</h1>
        <p>Перетягніть картку в іншу колонку, щоб змінити статус.</p>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div className="kanban-board">
          {kanbanStatuses.map((status) => (
            <section
              key={status}
              className={
                overStatus === status
                  ? "kanban-column drop-target"
                  : "kanban-column"
              }
              onDragOver={(event) => handleDragOver(event, status)}
              onDragLeave={() => setOverStatus(null)}
              onDrop={() => handleDrop(status)}
            >
              <h2>
                {taskStatusNames[status]} <span>{groups[status].length}</span>
              </h2>
              {groups[status].map((task) => {
                const movable = movableStatuses.includes(task.status);
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
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStatus(null);
                    }}
                  >
                    <Link to={`/tasks/${task.id}`}>
                      <strong>{task.title}</strong>
                    </Link>
                    <small>{task.description || "Без опису"}</small>
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
