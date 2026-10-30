import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { priorityNames, taskStatusNames } from "../types";
import type { Task, Project, ProjectMember, WorkSubmission } from "../types";
import {
  ErrorNotice,
  SubmissionCard,
  TaskSubmissionForm,
} from "./TaskSubmissions";

export function TaskDetailsPage() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const task = useApi<Task>(`/tasks/${taskId}`);
  // Проєкт, учасники й результати завантажуються лише після завдання, бо потрібен його projectId.
  const project = useApi<Project>(
    task.data ? `/projects/${task.data.projectId}` : null,
  );
  const members = useApi<ProjectMember[]>(
    task.data ? `/projects/${task.data.projectId}/members` : null,
  );
  const submissions = useApi<WorkSubmission[]>(
    task.data ? `/tasks/${taskId}/submissions?page=${page}&limit=20` : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function refresh() {
    task.refresh();
    project.refresh();
    submissions.refresh();
  }

  // Переводить завдання між «До виконання» і «У роботі».
  async function changeStatus(status: "TODO" | "IN_PROGRESS") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: { status },
      });
      refresh();
    } catch (error) {
      setError(errorMessage(error));
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
  const owner = user?.role === "ADMIN" || currentProject.clientId === user?.id;
  const closed = ["COMPLETED", "CANCELLED"].includes(currentProject.status);
  const projectActive = currentProject.status === "ACTIVE";
  const isAssignee = currentTask.assigneeId === user?.id;

  // Редагувати можна, поки завдання не передано на перевірку й не завершено.
  const canEdit =
    owner && !closed && !["REVIEW", "DONE"].includes(currentTask.status);
  const canChangeStatus =
    projectActive &&
    ["TODO", "IN_PROGRESS"].includes(currentTask.status) &&
    (isAssignee || user?.role === "ADMIN");
  const canSubmit =
    projectActive && currentTask.status === "IN_PROGRESS" && isAssignee;
  const canReview = owner && !closed && currentTask.status === "REVIEW";

  const assigneeName =
    members.data.find((member) => member.userId === currentTask.assigneeId)
      ?.user?.name || "Не призначено";
  const nextStatus = currentTask.status === "TODO" ? "IN_PROGRESS" : "TODO";

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
              Редагувати завдання
            </Link>
          )}
          <button className="button secondary" onClick={refresh}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            Оновити дані
          </button>
        </div>
      </div>
      <section className="data-panel project-overview">
        <p className="project-full-description">
          {currentTask.description || "Опис не додано."}
        </p>
        <dl className="project-facts">
          <Fact label="Статус">{taskStatusNames[currentTask.status]}</Fact>
          <Fact label="Пріоритет">{priorityNames[currentTask.priority]}</Fact>
          <Fact label="Виконавець">{assigneeName}</Fact>
          <Fact label="Дедлайн">{formatDate(currentTask.deadline, true)}</Fact>
        </dl>
        {canChangeStatus && (
          <div className="page-actions section-gap">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void changeStatus(nextStatus)}
            >
              {currentTask.status === "TODO"
                ? "Почати виконання"
                : "Повернути до плану"}
            </button>
          </div>
        )}
        {!projectActive && !closed && (
          <p className="form-note section-gap">
            Виконання й передавання результатів доступні після активації проєкту
            клієнтом.
          </p>
        )}
        <ErrorNotice message={error} />
      </section>
      {canSubmit && (
        <section className="data-panel padded section-gap">
          <h2>Передати результат роботи</h2>
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
          <h2>Результати та перевірки</h2>
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
                  Результатів на цій сторінці ще немає.
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
