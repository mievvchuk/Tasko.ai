import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { FileDownload, FileUpload } from "../components/FileActions";
import { Pagination, ResourceState } from "../components/ResourceState";
import {
  priorityNames,
  taskStatusNames,
  submissionStatusNames,
} from "../types";
import type {
  Task,
  Project,
  ProjectMember,
  WorkSubmission,
  FileAttachment,
} from "../types";

export function TaskDetailsPage() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const task = useApi<Task>(`/tasks/${taskId}`);
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
  const owner = user?.role === "ADMIN" || project.data.clientId === user?.id;
  const closed = ["COMPLETED", "CANCELLED"].includes(project.data.status);
  const canChangeStatus =
    project.data.status === "ACTIVE" &&
    ["TODO", "IN_PROGRESS"].includes(task.data.status) &&
    (task.data.assigneeId === user?.id || user?.role === "ADMIN");
  const canSubmit =
    project.data.status === "ACTIVE" &&
    task.data.status === "IN_PROGRESS" &&
    task.data.assigneeId === user?.id;
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${project.data.id}`}>
        ← {project.data.title}
      </Link>
      <div className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">TASKO.AI / ЗАВДАННЯ</span>
          <h1>{task.data.title}</h1>
        </div>
        <div className="page-actions">
          {owner &&
            !closed &&
            !["REVIEW", "DONE"].includes(task.data.status) && (
              <Link className="button primary" to={`/tasks/${taskId}/edit`}>
                Редагувати завдання
              </Link>
            )}
          <button className="button secondary" onClick={refresh}>
            Оновити дані
          </button>
        </div>
      </div>
      <section className="data-panel project-overview">
        <p className="project-full-description">
          {task.data.description || "Опис не додано."}
        </p>
        <dl className="project-facts">
          <div>
            <dt>Статус</dt>
            <dd>{taskStatusNames[task.data.status]}</dd>
          </div>
          <div>
            <dt>Пріоритет</dt>
            <dd>{priorityNames[task.data.priority]}</dd>
          </div>
          <div>
            <dt>Виконавець</dt>
            <dd>
              {members.data.find(
                (member) => member.userId === task.data?.assigneeId,
              )?.user?.name || "Не призначено"}
            </dd>
          </div>
          <div>
            <dt>Дедлайн</dt>
            <dd>{formatDate(task.data.deadline, true)}</dd>
          </div>
        </dl>
        {canChangeStatus && (
          <div className="page-actions section-gap">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                void changeStatus(
                  task.data?.status === "TODO" ? "IN_PROGRESS" : "TODO",
                );
              }}
            >
              {task.data.status === "TODO"
                ? "Почати виконання"
                : "Повернути до плану"}
            </button>
          </div>
        )}
        {project.data.status !== "ACTIVE" && !closed && (
          <p className="form-note section-gap">
            Виконання й передавання результатів доступні після активації проєкту
            клієнтом.
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </section>
      {canSubmit && (
        <section className="data-panel padded section-gap">
          <h2>Передати результат роботи</h2>
          <SubmissionForm
            task={task.data}
            onSubmitted={() => {
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
                <article className="submission-card" key={submission.id}>
                  <div className="record-heading">
                    <strong>{submissionStatusNames[submission.status]}</strong>
                    <time dateTime={submission.submittedAt}>
                      {formatDate(submission.submittedAt, true)}
                    </time>
                  </div>
                  <p className="preserve-lines">{submission.description}</p>
                  {submission.files.map((file) => (
                    <FileDownload key={file.id} file={file} />
                  ))}
                  {submission.feedback && (
                    <div className="review-feedback">
                      <strong>Відгук перевірки</strong>
                      <p className="preserve-lines">{submission.feedback}</p>
                      <small>{formatDate(submission.reviewedAt, true)}</small>
                    </div>
                  )}
                  {owner &&
                    !closed &&
                    task.data?.status === "REVIEW" &&
                    submission.status === "SUBMITTED" && (
                      <ReviewForm
                        submissionId={submission.id}
                        onReviewed={refresh}
                      />
                    )}
                </article>
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

function SubmissionForm({
  task,
  onSubmitted,
}: {
  task: Task;
  onSubmitted: () => void;
}) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading) return;
    setError("");
    if (!description.trim()) {
      setError("Опишіть результат роботи.");
      return;
    }
    setBusy(true);
    try {
      await request(`/tasks/${task.id}/submissions`, {
        method: "POST",
        body: {
          description: description.trim(),
          fileIds: files.map((file) => file.id),
        },
      });
      onSubmitted();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="form-note">
        За потреби спочатку завантажте файли (до 10). Після передавання завдання
        перейде на перевірку.
      </p>
      <FileUpload
        projectId={task.projectId}
        disabled={busy || files.length >= 10}
        onBusyChange={setUploading}
        onUploaded={(file) => setFiles((previous) => [...previous, file])}
      />
      <ul className="record-list">
        {files.map((file) => (
          <li key={file.id}>
            <FileDownload file={file} />
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                setFiles(files.filter((item) => item.id !== file.id))
              }
            >
              Не додавати до результату
            </button>
          </li>
        ))}
      </ul>
      <form className="work-form" onSubmit={submit}>
        <label htmlFor="submission-description">Опис результату</label>
        <textarea
          id="submission-description"
          required
          maxLength={10000}
          rows={5}
          value={description}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || uploading}>
          {busy ? "Передаємо…" : "Передати на перевірку"}
        </button>
      </form>
    </>
  );
}

function ReviewForm({
  submissionId,
  onReviewed,
}: {
  submissionId: string;
  onReviewed: () => void;
}) {
  const [decision, setDecision] = useState("APPROVE");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!feedback.trim()) {
      setError("Додайте відгук до рішення.");
      return;
    }
    setBusy(true);
    try {
      await request(`/submissions/${submissionId}/review`, {
        method: "POST",
        body: { decision, feedback: feedback.trim() },
      });
      onReviewed();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="work-form review-form" onSubmit={submit}>
      <fieldset disabled={busy} className="form-fields">
        <label htmlFor={`decision-${submissionId}`}>Рішення</label>
        <select
          id={`decision-${submissionId}`}
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option value="APPROVE">Прийняти роботу</option>
          <option value="NEEDS_REVISION">Повернути на доопрацювання</option>
        </select>
        <label htmlFor={`feedback-${submissionId}`}>Відгук</label>
        <textarea
          id={`feedback-${submissionId}`}
          rows={3}
          required
          maxLength={5000}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary">
          {busy ? "Зберігаємо…" : "Зберегти рішення"}
        </button>
      </fieldset>
    </form>
  );
}
