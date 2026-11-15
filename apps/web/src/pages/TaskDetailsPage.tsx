import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { priorityNames, ratingStars, taskStatusNames } from "../types";
import type { Task, Project, ProjectMember, WorkSubmission } from "../types";
import {
  ErrorNotice,
  SubmissionCard,
  TaskSubmissionForm,
} from "./TaskSubmissions";

import { useLanguage } from "../i18n";
export function TaskDetailsPage() {
  const { tr } = useLanguage();
  const { taskId } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const task = useApi<Task>(`/tasks/${taskId}`, { live: true });
  // Проєкт, учасники й результати завантажуються лише після завдання, бо потрібен його projectId.
  const project = useApi<Project>(
    task.data ? `/projects/${task.data.projectId}` : null,
    { live: true },
  );
  const members = useApi<ProjectMember[]>(
    task.data ? `/projects/${task.data.projectId}/members` : null,
    { live: true },
  );
  const submissions = useApi<WorkSubmission[]>(
    task.data ? `/tasks/${taskId}/submissions?page=${page}&limit=20` : null,
    { live: true },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    task.refresh();
    project.refresh();
    submissions.refresh();
  }

  // Переміщення завдання за тими самими правилами, що й на Kanban-дошці
  async function changeStatus(
    status: "TODO" | "IN_PROGRESS" | "REVISION",
    reason?: string,
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await request(`/tasks/${taskId}/move`, {
        method: "POST",
        body: { status, reason },
      });
      refresh();
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!task.data || !project.data || !members.data)
    return (
      <ResourceState
        loading={task.loading || project.loading || members.loading}
        error={task.error || project.error || members.error}
        onRetry={() => {
          refresh();
          members.refresh();
        }}
      />
    );

  const currentTask = task.data;
  const currentProject = project.data;
  const owner = currentProject.clientId === user?.id;
  const closed = ["COMPLETED", "CANCELLED"].includes(currentProject.status);
  const projectActive = currentProject.status === "ACTIVE";
  const isAssignee = currentTask.assigneeId === user?.id;

  // Редагувати можна, поки завдання не передано на перевірку й не завершено.
  const canEdit =
    owner && !closed && !["REVIEW", "DONE"].includes(currentTask.status);
  // Виконавець бере в роботу, повертає до плану або продовжує після доопрацювання
  const canChangeStatus =
    projectActive &&
    ["TODO", "IN_PROGRESS", "REVISION"].includes(currentTask.status) &&
    isAssignee;
  // Прийняту роботу замовник може повернути на доопрацювання з причиною
  const canReopen = owner && projectActive && currentTask.status === "DONE";
  const canSubmit =
    projectActive && currentTask.status === "IN_PROGRESS" && isAssignee;
  const canReview = owner && !closed && currentTask.status === "REVIEW";

  const assigneeName = currentTask.assigneeId ? (
    <Link to={`/freelancers/${currentTask.assigneeId}`}>
      {members.data.find((member) => member.userId === currentTask.assigneeId)
        ?.user?.name || tr("Учасник недоступний")}
    </Link>
  ) : (
    tr("Не призначено")
  );
  const nextStatus =
    currentTask.status === "IN_PROGRESS" ? "TODO" : "IN_PROGRESS";

  return (
    <>
      <Link className="breadcrumb" to={`/projects/${currentProject.id}`}>
        ← {currentProject.title}
      </Link>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{currentTask.title}</h1>
        </div>
        <div className="page-actions">
          {canEdit && (
            <Link className="button primary" to={`/tasks/${taskId}/edit`}>
              <i className="bi bi-pencil" aria-hidden="true"></i>

              {tr("Редагувати завдання")}
            </Link>
          )}
          <button className="button secondary" onClick={refresh}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

            {tr("Оновити дані")}
          </button>
        </div>
      </div>
      <section className="data-panel project-overview">
        <p className="project-full-description">
          {currentTask.description || tr("Опис не додано.")}
        </p>
        <dl className="project-facts">
          <Fact label={tr("Статус")}>
            {tr(taskStatusNames[currentTask.status])}
          </Fact>
          <Fact label={tr("Пріоритет")}>
            {tr(priorityNames[currentTask.priority])}
          </Fact>
          <Fact label={tr("Рейтинг")}>
            {currentTask.rating ? (
              <span aria-label={`${currentTask.rating} / 5`}>
                {ratingStars(currentTask.rating)}
              </span>
            ) : (
              tr("Не задано")
            )}
          </Fact>
          <Fact label={tr("Виконавець")}>{assigneeName}</Fact>
          <Fact label={tr("Дедлайн")}>
            {formatDate(currentTask.deadline, true)}
          </Fact>
        </dl>
        {canChangeStatus && (
          <div className="page-actions section-gap">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void changeStatus(nextStatus)}
            >
              {currentTask.status === "TODO"
                ? tr("Почати виконання")
                : currentTask.status === "REVISION"
                  ? tr("Продовжити роботу")
                  : tr("Повернути до плану")}
            </button>
          </div>
        )}
        {currentTask.status === "REVISION" && isAssignee && (
          <p className="form-note section-gap">
            {tr(
              "Замовник повернув завдання на доопрацювання — причина в результатах нижче та в сповіщеннях.",
            )}
          </p>
        )}
        {canReopen && (
          <ReopenTask
            busy={busy}
            onReopen={(reason) => changeStatus("REVISION", reason)}
          />
        )}
        {!projectActive && !closed && (
          <p className="form-note section-gap">
            {tr(
              "Виконання й передавання результатів доступні після активації проєкту клієнтом.",
            )}
          </p>
        )}
        <ErrorNotice message={error} />
      </section>
      {canSubmit && (
        <section className="data-panel padded section-gap">
          <h2>{tr("Передати результат роботи")}</h2>
          <TaskSubmissionForm
            task={currentTask}
            onSubmitted={() => {
              // Повертаємося на першу сторінку, де з'явиться новий результат.
              setParams({});
              refresh();
            }}
          />
        </section>
      )}
      <section className="data-panel section-gap">
        <div className="panel-heading">
          <h2>{tr("Результати та перевірки")}</h2>
        </div>
        <ResourceState
          loading={submissions.loading}
          error={submissions.error}
          onRetry={submissions.refresh}
        />
        {submissions.data && (
          <>
            <div className="padded">
              {!submissions.data.length && (
                <p className="form-note">
                  {tr("Результатів на цій сторінці ще немає.")}
                </p>
              )}
              {submissions.data.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
                  canReview={canReview}
                  onReviewed={refresh}
                />
              ))}
            </div>
            <Pagination
              page={page}
              count={submissions.data.length}
              onChange={(value) => setParams({ page: String(value) })}
            />
          </>
        )}
      </section>
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// Повернення прийнятого завдання на доопрацювання: причина обов'язкова
function ReopenTask({
  busy,
  onReopen,
}: {
  busy: boolean;
  onReopen: (reason: string) => Promise<boolean>;
}) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <div className="page-actions section-gap">
        <button className="button secondary" onClick={() => setOpen(true)}>
          <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
          {tr("Повернути на доопрацювання")}
        </button>
      </div>
    );
  return (
    <form
      className="work-form section-gap"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onReopen(reason.trim())) {
          setOpen(false);
          setReason("");
        }
      }}
    >
      <label htmlFor="reopen-reason">{tr("Що потрібно виправити")}</label>
      <textarea
        id="reopen-reason"
        required
        rows={3}
        maxLength={2000}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="page-actions">
        <button className="button primary" disabled={busy || !reason.trim()}>
          {tr("Повернути")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setOpen(false)}
        >
          {tr("Скасувати")}
        </button>
      </div>
    </form>
  );
}
