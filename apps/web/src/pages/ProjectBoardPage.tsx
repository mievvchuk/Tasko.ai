import { useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import { boardLanes, isOverdue, tasksInLane, type Lane } from "../kanban";
import {
  priorityNames,
  taskStatusNames,
  type BoardColumn,
  type Project,
  type Task,
  type TaskStatus,
} from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
// Сервер дозволяє вручну перемикати лише ці два статуси (і власні колонки «У процесі»).
// «На перевірці» — це передавання результату, а «Завершено» ставить клієнт.
const movableStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS"];

export function ProjectBoardPage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, refresh } = useApi<Task[]>(
    id ? `/projects/${id}/tasks?limit=50` : null,
  );
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const columns = useApi<BoardColumn[]>(id ? `/projects/${id}/columns` : null);
  const [actionError, setActionError] = useState("");
  // Яку картку тягнемо і над якою колонкою вона зараз
  const [dragId, setDragId] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState("");

  const lanes = boardLanes(columns.data ?? []);
  const tasks = data ?? [];
  // Колонки додає й видаляє власник проєкту (або адміністратор)
  const isOwner = user?.role === "ADMIN" || project.data?.clientId === user?.id;

  // Перетягувати можна лише своє завдання (або будь-яке — адміністратору)
  function canMove(task: Task) {
    const allowed = task.assigneeId === user?.id || user?.role === "ADMIN";
    return allowed && movableStatuses.includes(task.status);
  }

  async function run(action: () => Promise<unknown>) {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  function move(task: Task, lane: Lane) {
    return run(async () => {
      await request(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: { status: lane.status, columnId: lane.columnId ?? undefined },
      });
      refresh();
    });
  }

  function addColumn(event: FormEvent) {
    event.preventDefault();
    return run(async () => {
      await request(`/projects/${id}/columns`, {
        method: "POST",
        body: { title: newColumn },
      });
      setNewColumn("");
      columns.refresh();
    });
  }

  function deleteColumn(lane: Lane) {
    const question = tr(
      "Видалити колонку «{0}»? Її завдання повернуться в «У процесі».",
      lane.title ?? "",
    );
    if (!confirm(question)) return;
    return run(async () => {
      await request(`/columns/${lane.columnId}`, { method: "DELETE" });
      columns.refresh();
      refresh();
    });
  }

  // Обробники drag-and-drop (вбудований HTML5 API, без бібліотек)
  function handleDragOver(event: DragEvent, lane: Lane) {
    if (!dragId || !movableStatuses.includes(lane.status)) return;
    event.preventDefault(); // без цього браузер не дозволить «кинути» сюди
    setOverLane(lane.key);
  }
  function handleDrop(lane: Lane) {
    const task = tasks.find((item) => item.id === dragId);
    if (task && !tasksInLane([task], lane).length) void move(task, lane);
    stopDragging();
  }
  function stopDragging() {
    setDragId(null);
    setOverLane(null);
  }

  // Клас колонки: під карткою — підсвічена, куди не можна кинути — бліда
  function laneClass(lane: Lane) {
    let className = `kanban-column column-${lane.status}`;
    if (lane.columnId) className += " custom";
    if (overLane === lane.key) className += " drop-target";
    if (dragId && !movableStatuses.includes(lane.status))
      className += " locked";
    return className;
  }

  const movableLanes = lanes.filter((lane) =>
    movableStatuses.includes(lane.status),
  );
  const laneTitle = (lane: Lane) =>
    lane.title ?? tr(taskStatusNames[lane.status]);
  const anyMovable = tasks.some(canMove);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Дошка завдань")}</h1>
        <p>
          {anyMovable
            ? tr(
                "Перетягніть свою картку в іншу колонку або виберіть колонку у списку на картці.",
              )
            : tr("Статус завдання змінює призначений виконавець.")}
        </p>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div className="kanban-board">
          {lanes.map((lane) => {
            const laneTasks = tasksInLane(tasks, lane);
            return (
              <section
                key={lane.key}
                className={laneClass(lane)}
                onDragOver={(event) => handleDragOver(event, lane)}
                onDragLeave={() => setOverLane(null)}
                onDrop={() => handleDrop(lane)}
              >
                <h2>
                  <span className="kanban-title">{laneTitle(lane)}</span>
                  <span className="kanban-count">{laneTasks.length}</span>
                  {lane.columnId && isOwner && (
                    <button
                      type="button"
                      className="kanban-remove"
                      aria-label={tr("Видалити колонку {0}", laneTitle(lane))}
                      title={tr("Видалити колонку")}
                      onClick={() => void deleteColumn(lane)}
                    >
                      <i className="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                  )}
                </h2>
                {!laneTasks.length && (
                  <p className="kanban-empty">
                    {movableStatuses.includes(lane.status) && anyMovable
                      ? tr("Перетягніть сюди картку")
                      : tr("Порожньо")}
                  </p>
                )}
                {laneTasks.map((task) => {
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
                      {task.description && <small>{task.description}</small>}
                      <div className="kanban-meta">
                        <span className={`priority priority-${task.priority}`}>
                          {tr(priorityNames[task.priority])}
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
                      {/* select лишаємо — ним можна змінити колонку з клавіатури */}
                      {movable && (
                        <select
                          aria-label={tr("Колонка завдання {0}", task.title)}
                          value={
                            tasksInLane([task], lane).length ? lane.key : ""
                          }
                          onChange={(event) => {
                            const target = movableLanes.find(
                              (item) => item.key === event.target.value,
                            );
                            if (target) void move(task, target);
                          }}
                        >
                          {movableLanes.map((item) => (
                            <option key={item.key} value={item.key}>
                              {laneTitle(item)}
                            </option>
                          ))}
                        </select>
                      )}
                    </article>
                  );
                })}
                {/* Власник додає власну колонку одразу після останньої «У процесі» */}
                {isOwner &&
                  lane.status === "IN_PROGRESS" &&
                  lane === movableLanes.at(-1) && (
                    <form className="kanban-add" onSubmit={addColumn}>
                      <label htmlFor="new-column">
                        {tr("Новий етап роботи")}
                      </label>
                      <input
                        id="new-column"
                        required
                        minLength={2}
                        maxLength={40}
                        placeholder={tr("Наприклад, Тестування")}
                        value={newColumn}
                        onChange={(event) => setNewColumn(event.target.value)}
                      />
                      <button className="button secondary">
                        <i className="bi bi-plus-lg" aria-hidden="true"></i>
                        {tr("Додати колонку")}
                      </button>
                    </form>
                  )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
