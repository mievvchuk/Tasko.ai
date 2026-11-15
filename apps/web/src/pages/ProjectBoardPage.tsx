import { Fragment, useEffect, useRef, useState } from "react";
import type { DragEvent, FormEvent, PointerEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import {
  boardLanes,
  isOverdue,
  laneOrder,
  laneRule,
  movedTask,
  stageAt,
  tasksInLane,
  type Lane,
  type MoveActor,
} from "../kanban";
import {
  priorityNames,
  taskStatusNames,
  type BoardColumn,
  type Project,
  type ProjectMember,
  type Task,
} from "../types";
import { useApi } from "../useApi";
import { AdminDialog } from "./AdminSections";

import { useLanguage } from "../i18n";

// Переміщення, яке чекає на коментар (здача на перевірку) чи причину (доопрацювання)
interface PendingMove {
  task: Task;
  lane: Lane;
  needs: "comment" | "reason";
}

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
  // Яку картку тягнемо і над якою колонкою вона зараз
  const [dragId, setDragId] = useState<string | null>(null);
  // Куди вставляємо нову колонку (індекс проміжку) і яку колонку зараз тягнуть
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [columnDrag, setColumnDrag] = useState<string | null>(null);
  // Поки картку чи колонку тягнуть, дошку не перемальовуємо: після відпускання вона й так оновиться
  const live = { live: !dragId && !columnDrag };
  const { data, error, loading, refresh } = useApi<Task[]>(
    id ? `/projects/${id}/tasks?limit=50` : null,
    live,
  );
  const project = useApi<Project>(id ? `/projects/${id}` : null, live);
  const columns = useApi<BoardColumn[]>(
    id ? `/projects/${id}/columns` : null,
    live,
  );
  // Учасники — щоб знати, чи може фрілансер узяти вільне завдання
  const members = useApi<ProjectMember[]>(
    id ? `/projects/${id}/members` : null,
    live,
  );
  const [actionError, setActionError] = useState("");
  // Картки, переміщені до відповіді сервера: показуємо одразу, при помилці повертаємо назад
  const [moved, setMoved] = useState<Record<string, Task>>({});
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [renaming, setRenaming] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<Lane | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState("");
  const [overGap, setOverGap] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  // Свіжі дані з сервера замінюють миттєві переміщення
  useEffect(() => setMoved({}), [data]);

  const lanes = boardLanes(columns.data ?? []);
  const tasks = (data ?? []).map((task) => moved[task.id] ?? task);
  // Структуру дошки (колонки) змінює лише замовник; переміщення — за правилами процесу
  const isOwner = project.data?.clientId === user?.id;
  const isMember =
    user?.role === "FREELANCER" &&
    Boolean(members.data?.some((member) => member.userId === user.id));
  const active = project.data?.status === "ACTIVE";
  const actorFor = (task: Task): MoveActor => ({
    isOwner,
    isAssignee: Boolean(task.assigneeId) && task.assigneeId === user?.id,
    isMember,
  });
  const ruleFor = (task: Task, lane: Lane) =>
    laneRule(task, lane, actorFor(task));
  const targetsFor = (task: Task) =>
    active ? lanes.filter((lane) => ruleFor(task, lane).allowed) : [];
  const canMove = (task: Task) => targetsFor(task).length > 0;

  async function run(action: () => Promise<unknown>) {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  // Переміщення картки: перевіряємо правило, за потреби питаємо коментар чи причину,
  // показуємо картку на новому місці одразу, а при помилці сервера повертаємо назад
  async function move(
    task: Task,
    lane: Lane,
    extra?: { comment?: string; reason?: string },
  ) {
    const rule = ruleFor(task, lane);
    if (!rule.allowed) {
      setActionError(tr(rule.reason));
      return false;
    }
    if (rule.needs && !extra) {
      setPending({ task, lane, needs: rule.needs });
      return false;
    }
    setActionError("");
    setMoved((items) => ({
      ...items,
      [task.id]: movedTask(task, lane, rule.takes ? user?.id : undefined),
    }));
    try {
      await request(`/tasks/${task.id}/move`, {
        method: "POST",
        body: {
          status: lane.status,
          columnId: lane.columnId ?? undefined,
          ...extra,
        },
      });
      return true;
    } catch (error) {
      setMoved((items) => {
        const rest = { ...items };
        delete rest[task.id];
        return rest;
      });
      setActionError(errorMessage(error));
      return false;
    } finally {
      refresh();
    }
  }
  const laneFor = (status: Task["status"]) =>
    lanes.find((lane) => lane.status === status && !lane.columnId)!;

  // Колонки до «На перевірці» можна ставити будь-де; етап визначає місце
  const order = laneOrder(lanes);
  function saveOrder(next: string[]) {
    return request(`/projects/${id}/columns/order`, {
      method: "PUT",
      body: { order: next },
    });
  }
  function addColumn(event: FormEvent) {
    event.preventDefault();
    const at = insertAt ?? order.length;
    return run(async () => {
      const created = await request<BoardColumn>(`/projects/${id}/columns`, {
        method: "POST",
        body: { title: newColumn.trim(), status: stageAt(order, at) },
      });
      const next = [...order];
      next.splice(at, 0, created.id);
      await saveOrder(next);
      setNewColumn("");
      setInsertAt(null);
      columns.refresh();
    });
  }
  function moveColumn(columnId: string, gap: number) {
    const from = order.indexOf(columnId);
    const to = gap > from ? gap - 1 : gap;
    if (from < 0 || to === from) return;
    const next = order.filter((key) => key !== columnId);
    next.splice(to, 0, columnId);
    return run(async () => {
      await saveOrder(next);
      columns.refresh();
      refresh();
    });
  }
  function dropColumn(event: DragEvent, gap: number) {
    event.preventDefault();
    const columnId = event.dataTransfer.getData("text/x-column");
    setColumnDrag(null);
    setOverGap(null);
    if (columnId) void moveColumn(columnId, gap);
  }

  function renameColumn(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    const { id: columnId, title } = renaming;
    return run(async () => {
      await request(`/columns/${columnId}`, {
        method: "PATCH",
        body: { title: title.trim() },
      });
      setRenaming(null);
      columns.refresh();
    });
  }

  // Видалення колонки: картки переходять у вибрану колонку того самого етапу
  function deleteColumn(lane: Lane, moveTo: string) {
    return run(async () => {
      const query = moveTo ? `?moveTo=${moveTo}` : "";
      await request(`/columns/${lane.columnId}${query}`, { method: "DELETE" });
      setDeleting(null);
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
    setOverLane(laneAt(drag.lastX, drag.lastY)?.key ?? null);
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
      // Кинули в ту саму колонку — нічого не робимо; в недоступну — пояснюємо чому
      if (lane && !tasksInLane([drag.task], lane).length)
        void move(drag.task, lane);
    }
    setDragId(null);
    setOverLane(null);
  }

  const dragged = dragId ? tasks.find((task) => task.id === dragId) : null;
  // Клас колонки під час перетягування: доступна — з рамкою, під карткою — підсвічена,
  // недоступна — бліда (причину показує підказка над дошкою)
  function laneClass(lane: Lane) {
    let className = `kanban-column column-${lane.status}`;
    if (lane.columnId) className += " custom";
    if (dragged && !tasksInLane([dragged], lane).length) {
      const allowed = ruleFor(dragged, lane).allowed;
      className += allowed ? " drop-allowed" : " locked";
      if (allowed && overLane === lane.key) className += " drop-target";
    }
    return className;
  }
  const overTarget = lanes.find((lane) => lane.key === overLane);
  const dragHint =
    dragged && overTarget && !tasksInLane([dragged], overTarget).length
      ? ruleFor(dragged, overTarget)
      : null;

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
                "Перетягніть картку за ручку або виберіть «Змінити етап» на картці. Доступні колонки підсвічуються.",
              )
            : tr(
                "Картку рухає її виконавець, а перевіряє й приймає роботу замовник.",
              )}
          {isOwner &&
            " " +
              tr(
                "Наведіть між колонками й натисніть «+», щоб додати колонку. Власні колонки перетягуйте за заголовок.",
              )}
        </p>
      </div>
      {actionError && (
        <p className="notice error" role="alert">
          {actionError}
        </p>
      )}
      {/* Під час перетягування: куди можна кинути картку, а куди ні й чому */}
      {dragHint && (
        <p
          className={
            dragHint.allowed ? "kanban-drag-hint" : "kanban-drag-hint denied"
          }
          role="status"
        >
          <i
            className={
              dragHint.allowed
                ? "bi bi-arrow-down-circle"
                : "bi bi-slash-circle"
            }
            aria-hidden="true"
          ></i>
          {dragHint.allowed
            ? tr("Відпустіть, щоб перемістити в «{0}»", laneTitle(overTarget!))
            : tr(dragHint.reason)}
        </p>
      )}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div
          ref={boardRef}
          className={dragId ? "kanban-board is-dragging" : "kanban-board"}
        >
          {lanes.map((lane, index) => {
            const laneTasks = tasksInLane(tasks, lane);
            const draggable = isOwner && Boolean(lane.columnId);
            return (
              <Fragment key={lane.key}>
                {isOwner && index <= order.length && (
                  <ColumnGap
                    index={index}
                    active={overGap === index}
                    dragging={Boolean(columnDrag)}
                    onAdd={() => {
                      setInsertAt(index);
                      setNewColumn("");
                    }}
                    onOver={setOverGap}
                    onDrop={dropColumn}
                  />
                )}
                {insertAt === index && (
                  <form
                    className="kanban-column kanban-new"
                    onSubmit={addColumn}
                  >
                    <input
                      autoFocus
                      required
                      minLength={2}
                      maxLength={40}
                      aria-label={tr("Назва нової колонки")}
                      placeholder={tr("Назва колонки")}
                      value={newColumn}
                      onChange={(event) => setNewColumn(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setInsertAt(null);
                      }}
                    />
                    <p className="form-note">
                      {stageAt(order, index) === "TODO"
                        ? tr(
                            "Етап «До виконання». Enter — додати, Esc — скасувати.",
                          )
                        : tr(
                            "Етап «У процесі». Enter — додати, Esc — скасувати.",
                          )}
                    </p>
                    <div className="page-actions">
                      <button className="button primary">{tr("Додати")}</button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => setInsertAt(null)}
                      >
                        {tr("Скасувати")}
                      </button>
                    </div>
                  </form>
                )}
                <section
                  data-lane={lane.key}
                  className={
                    laneClass(lane) +
                    (columnDrag && columnDrag === lane.columnId
                      ? " column-dragging"
                      : "")
                  }
                >
                  <h2
                    draggable={draggable}
                    tabIndex={draggable ? 0 : undefined}
                    title={
                      draggable
                        ? tr("Перетягніть, щоб змінити місце колонки")
                        : undefined
                    }
                    onDragStart={(event) => {
                      if (!draggable || !lane.columnId) return;
                      event.dataTransfer.setData(
                        "text/x-column",
                        lane.columnId,
                      );
                      event.dataTransfer.effectAllowed = "move";
                      setColumnDrag(lane.columnId);
                    }}
                    onDragEnd={() => {
                      setColumnDrag(null);
                      setOverGap(null);
                    }}
                    // З клавіатури: стрілки вліво/вправо пересувають колонку на одне місце
                    onKeyDown={(event) => {
                      if (!draggable || !lane.columnId) return;
                      const from = order.indexOf(lane.columnId);
                      if (event.key === "ArrowLeft" && from > 0)
                        void moveColumn(lane.columnId, from - 1);
                      if (event.key === "ArrowRight" && from < order.length - 1)
                        void moveColumn(lane.columnId, from + 2);
                    }}
                  >
                    {draggable && (
                      <i
                        className="bi bi-grip-vertical column-grip"
                        aria-hidden="true"
                      ></i>
                    )}
                    {renaming?.id === lane.columnId ? (
                      <form className="kanban-rename" onSubmit={renameColumn}>
                        <input
                          autoFocus
                          required
                          minLength={2}
                          maxLength={40}
                          aria-label={tr("Нова назва колонки")}
                          value={renaming.title}
                          onChange={(event) =>
                            setRenaming({
                              id: renaming.id,
                              title: event.target.value,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Escape") setRenaming(null);
                          }}
                        />
                      </form>
                    ) : (
                      <span className="kanban-title">{laneTitle(lane)}</span>
                    )}
                    <span className="kanban-count">{laneTasks.length}</span>
                    {lane.columnId && isOwner && !renaming && (
                      <>
                        <button
                          type="button"
                          className="kanban-remove"
                          aria-label={tr(
                            "Перейменувати колонку {0}",
                            laneTitle(lane),
                          )}
                          title={tr("Перейменувати колонку")}
                          onClick={() =>
                            setRenaming({
                              id: lane.columnId!,
                              title: laneTitle(lane),
                            })
                          }
                        >
                          <span
                            className="bi bi-pencil"
                            aria-hidden="true"
                          ></span>
                        </button>
                        <button
                          type="button"
                          className="kanban-remove"
                          aria-label={tr(
                            "Видалити колонку {0}",
                            laneTitle(lane),
                          )}
                          title={tr("Видалити колонку")}
                          onClick={() => setDeleting(lane)}
                        >
                          <span
                            className="bi bi-x-lg"
                            aria-hidden="true"
                          ></span>
                        </button>
                      </>
                    )}
                  </h2>
                  {!laneTasks.length && (
                    <p className="kanban-empty">{tr("Порожньо")}</p>
                  )}
                  {laneTasks.map((task) => {
                    const targets = targetsFor(task);
                    const movable = targets.length > 0;
                    // Перевірка роботи — дві основні дії замовника прямо на картці
                    const reviewing =
                      isOwner && active && task.status === "REVIEW";
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
                          <span
                            className={`priority priority-${task.priority}`}
                          >
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
                        {reviewing ? (
                          <div className="kanban-review">
                            <button
                              type="button"
                              className="button primary"
                              onClick={() => void move(task, laneFor("DONE"))}
                            >
                              <i
                                className="bi bi-check2-circle"
                                aria-hidden="true"
                              ></i>
                              {tr("Прийняти")}
                            </button>
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                void move(task, laneFor("REVISION"))
                              }
                            >
                              <i
                                className="bi bi-arrow-counterclockwise"
                                aria-hidden="true"
                              ></i>
                              {tr("На доопрацювання")}
                            </button>
                          </div>
                        ) : (
                          // Альтернатива перетягуванню: лише доступні етапи
                          movable && (
                            <select
                              aria-label={tr(
                                "Змінити етап завдання {0}",
                                task.title,
                              )}
                              value=""
                              onChange={(event) => {
                                const target = targets.find(
                                  (item) => item.key === event.target.value,
                                );
                                if (target) void move(task, target);
                              }}
                            >
                              <option value="">{tr("Змінити етап…")}</option>
                              {targets.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {laneTitle(item)}
                                </option>
                              ))}
                            </select>
                          )
                        )}
                      </article>
                    );
                  })}
                </section>
              </Fragment>
            );
          })}
        </div>
      )}
      {pending && (
        <MoveDialog
          pending={pending}
          onClose={() => setPending(null)}
          onSubmit={async (text) => {
            const done = await move(
              pending.task,
              pending.lane,
              pending.needs === "comment"
                ? { comment: text }
                : { reason: text },
            );
            if (done) setPending(null);
            return done;
          }}
        />
      )}
      {deleting && (
        <DeleteColumnDialog
          lane={deleting}
          lanes={lanes}
          count={tasksInLane(tasks, deleting).length}
          laneTitle={laneTitle}
          onClose={() => setDeleting(null)}
          onDelete={(moveTo) => deleteColumn(deleting, moveTo)}
        />
      )}
    </>
  );
}

// Здача на перевірку (коментар чи посилання) або повернення на доопрацювання (причина)
function MoveDialog({
  pending,
  onClose,
  onSubmit,
}: {
  pending: PendingMove;
  onClose: () => void;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const { tr } = useLanguage();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const review = pending.needs === "comment";
  return (
    <AdminDialog
      title={
        review ? tr("Передати на перевірку") : tr("Повернути на доопрацювання")
      }
      description={pending.task.title}
      onClose={onClose}
    >
      <form
        className="admin-dialog-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          await onSubmit(text.trim());
          setBusy(false);
        }}
      >
        <label>
          {review ? tr("Що зроблено") : tr("Що потрібно виправити")}
          <textarea
            autoFocus
            required
            rows={4}
            maxLength={review ? 10000 : 2000}
            value={text}
            placeholder={
              review
                ? tr(
                    "Коротко опишіть результат і додайте посилання: репозиторій, макет, документ.",
                  )
                : tr("Поясніть, що саме не так, щоб виконавець міг виправити.")
            }
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <p className="form-note">
          {review
            ? tr("Замовник отримає сповіщення й прийме роботу або поверне її.")
            : tr("Виконавець отримає сповіщення з цією причиною.")}
        </p>
        <div className="admin-dialog-actions">
          <button className="button primary" disabled={busy || !text.trim()}>
            {review ? tr("Передати") : tr("Повернути")}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            {tr("Скасувати")}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

// Видалення колонки: картки не губляться — вибираємо, куди їх перенести
function DeleteColumnDialog({
  lane,
  lanes,
  count,
  laneTitle,
  onClose,
  onDelete,
}: {
  lane: Lane;
  lanes: Lane[];
  count: number;
  laneTitle: (lane: Lane) => string;
  onClose: () => void;
  onDelete: (moveTo: string) => Promise<unknown> | undefined;
}) {
  const { tr } = useLanguage();
  // Сумісні колонки — того самого етапу; стандартна йде першою
  const options = lanes.filter(
    (item) => item.status === lane.status && item.key !== lane.key,
  );
  const [target, setTarget] = useState(options[0]?.columnId ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <AdminDialog
      title={tr("Видалити колонку «{0}»?", laneTitle(lane))}
      onClose={onClose}
    >
      <form
        className="admin-dialog-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          await onDelete(target);
          setBusy(false);
        }}
      >
        {count > 0 ? (
          <label>
            {tr("Куди перенести картки ({0})", count)}
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {options.map((item) => (
                <option key={item.key} value={item.columnId ?? ""}>
                  {laneTitle(item)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="form-note">{tr("У колонці немає карток.")}</p>
        )}
        <div className="admin-dialog-actions">
          <button className="button secondary danger-outline" disabled={busy}>
            {tr("Видалити колонку")}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            {tr("Скасувати")}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}

// Проміжок між колонками: «+» додає колонку тут, під час перетягування — місце, куди її кинути
function ColumnGap({
  index,
  active,
  dragging,
  onAdd,
  onOver,
  onDrop,
}: {
  index: number;
  active: boolean;
  dragging: boolean;
  onAdd: () => void;
  onOver: (index: number | null) => void;
  onDrop: (event: DragEvent, index: number) => void;
}) {
  const { tr } = useLanguage();
  return (
    <div
      className={
        "column-gap" + (dragging ? " droppable" : "") + (active ? " over" : "")
      }
      onDragOver={(event) => {
        if (!dragging) return;
        event.preventDefault();
        onOver(index);
      }}
      onDragLeave={() => onOver(null)}
      onDrop={(event) => onDrop(event, index)}
    >
      {!dragging && (
        <button
          type="button"
          className="column-gap-add"
          aria-label={tr("Додати колонку тут")}
          title={tr("Додати колонку тут")}
          onClick={onAdd}
        >
          <i className="bi bi-plus-lg" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
