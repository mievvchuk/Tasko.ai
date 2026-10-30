import { useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
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
// Сервер дозволяє вручну перемикати лише ці два статуси (і власні колонки цих етапів).
// «На перевірці» — це передавання результату, а «Завершено» ставить клієнт.
const movableStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS"];

// Картка, яку зараз тягнуть: звідки почали і скільки прокрутили з того часу
interface Drag {
  task: Task;
  card: HTMLElement;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  scrollLeft: number;
  scrollY: number;
  moved: boolean;
  timer?: number;
}

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
  const [newStage, setNewStage] = useState<BoardColumn["status"]>("TODO");
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const lanes = boardLanes(columns.data ?? []);
  const tasks = data ?? [];
  // Колонки додає й видаляє власник проєкту (або адміністратор)
  const isOwner = user?.role === "ADMIN" || project.data?.clientId === user?.id;

  // Пересувати картку може виконавець або власник проєкту
  function canMove(task: Task) {
    const allowed = task.assigneeId === user?.id || isOwner;
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
        body: { title: newColumn, status: newStage },
      });
      setNewColumn("");
      columns.refresh();
    });
  }

  function deleteColumn(lane: Lane) {
    const question = tr(
      "Видалити колонку «{0}»? Її завдання повернуться в «{1}».",
      lane.title ?? "",
      tr(taskStatusNames[lane.status]),
    );
    if (!confirm(question)) return;
    return run(async () => {
      await request(`/columns/${lane.columnId}`, { method: "DELETE" });
      columns.refresh();
      refresh();
    });
  }

  // Перетягування на Pointer Events: однаково працює з мишею і пальцем.
  // Мишею тягнуть усю картку, на сенсорному екрані — за «ручку», щоб свайп прокручував дошку.
  function laneAt(x: number, y: number) {
    const key = document
      .elementsFromPoint(x, y)
      .find((element) => element instanceof HTMLElement && element.dataset.lane)
      ?.getAttribute("data-lane");
    return lanes.find((lane) => lane.key === key);
  }
  function placeCard(drag: Drag) {
    const board = boardRef.current;
    const dx = drag.lastX - drag.x + (board?.scrollLeft ?? 0) - drag.scrollLeft;
    const dy = drag.lastY - drag.y + window.scrollY - drag.scrollY;
    drag.card.style.transform = `translate(${dx}px, ${dy}px) rotate(2deg)`;
    const lane = laneAt(drag.lastX, drag.lastY);
    setOverLane(lane && movableStatuses.includes(lane.status) ? lane.key : null);
  }
  // Біля краю екрана дошка і сторінка самі прокручуються, поки картку тримають
  function autoScroll(drag: Drag) {
    const board = boardRef.current;
    const edge = 48;
    let moved = false;
    if (board) {
      const { left, right } = board.getBoundingClientRect();
      const step =
        drag.lastX < left + edge ? -14 : drag.lastX > right - edge ? 14 : 0;
      if (step) {
        board.scrollLeft += step;
        moved = true;
      }
    }
    const bottom = window.innerHeight - 110; // над нижньою панеллю телефону
    const stepY = drag.lastY < 90 ? -12 : drag.lastY > bottom ? 12 : 0;
    if (stepY) {
      window.scrollBy(0, stepY);
      moved = true;
    }
    if (moved) placeCard(drag);
  }
  function startDrag(event: PointerEvent<HTMLElement>, task: Task) {
    const target = event.target as HTMLElement;
    if (!canMove(task) || event.button !== 0 || target.closest("select"))
      return;
    if (event.pointerType !== "mouse" && !target.closest(".kanban-grip"))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      task,
      card: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      scrollLeft: boardRef.current?.scrollLeft ?? 0,
      scrollY: window.scrollY,
      moved: false,
    };
  }
  function moveDrag(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.moved) {
      // Невеликий зсув — ще клік, а не перетягування
      if (Math.hypot(drag.lastX - drag.x, drag.lastY - drag.y) < 6) return;
      drag.moved = true;
      setDragId(drag.task.id);
      drag.timer = window.setInterval(() => autoScroll(drag), 16);
    }
    placeCard(drag);
  }
  function endDrag(event: PointerEvent<HTMLElement>, cancelled = false) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    window.clearInterval(drag.timer);
    drag.card.style.transform = "";
    if (drag.moved) {
      // Після перетягування браузер ще надішле click — не відкриваємо завдання
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(
        () => window.removeEventListener("click", swallow, { capture: true }),
        0,
      );
      const lane = cancelled ? undefined : laneAt(event.clientX, event.clientY);
      if (
        lane &&
        movableStatuses.includes(lane.status) &&
        !tasksInLane([drag.task], lane).length
      )
        void move(drag.task, lane);
    }
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
                "Перетягніть картку за ручку в іншу колонку або виберіть колонку у списку на картці.",
              )
            : tr("Статус завдання змінює призначений виконавець.")}
        </p>
      </div>
      {/* Власник додає колонку: перед «До виконання» (Беклог) чи після «У процесі» */}
      {isOwner && (
        <form className="kanban-add" onSubmit={addColumn}>
          <label htmlFor="new-column">{tr("Нова колонка")}</label>
          <input
            id="new-column"
            required
            minLength={2}
            maxLength={40}
            placeholder={tr("Наприклад, Беклог або Тестування")}
            value={newColumn}
            onChange={(event) => setNewColumn(event.target.value)}
          />
          <select
            aria-label={tr("Де розмістити колонку")}
            value={newStage}
            onChange={(event) =>
              setNewStage(event.target.value as BoardColumn["status"])
            }
          >
            <option value="TODO">{tr("Перед «До виконання»")}</option>
            <option value="IN_PROGRESS">{tr("Після «У процесі»")}</option>
          </select>
          <button className="button secondary">
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            {tr("Додати колонку")}
          </button>
        </form>
      )}
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div
          ref={boardRef}
          className={dragId ? "kanban-board is-dragging" : "kanban-board"}
        >
          {lanes.map((lane) => {
            const laneTasks = tasksInLane(tasks, lane);
            return (
              <section
                key={lane.key}
                data-lane={lane.key}
                className={laneClass(lane)}
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
                          : movable
                            ? "kanban-card movable"
                            : "kanban-card"
                      }
                      onPointerDown={(event) => startDrag(event, task)}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event)}
                      onPointerCancel={(event) => endDrag(event, true)}
                      // вимикаємо вбудоване перетягування посилань і тексту
                      onDragStart={(event) => event.preventDefault()}
                    >
                      <div className="kanban-card-title">
                        <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                        {movable && (
                          <span
                            className="kanban-grip"
                            title={tr("Перетягніть картку")}
                            aria-hidden="true"
                          >
                            <i className="bi bi-grip-vertical"></i>
                          </span>
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
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
