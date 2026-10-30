// Результати роботи над завданням: картка результату, форма передавання та форма перевірки.
import { useState } from "react";
import type { FormEvent } from "react";
import { request, errorMessage } from "../api";
import { formatDate } from "../format";
import { FileDownload, FileUpload } from "../components/FileActions";
import { submissionStatusNames } from "../types";
import type { Task, WorkSubmission, FileAttachment } from "../types";

import { useLanguage } from "../i18n";
const maxSubmissionFiles = 10;

export function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="notice error" role="alert">
      {message}
    </p>
  );
}

export function SubmissionCard({
  submission,
  canReview,
  onReviewed,
}: {
  submission: WorkSubmission;
  canReview: boolean;
  onReviewed: () => void;
}) {
  const { tr } = useLanguage();
  return (
    <article className="submission-card">
      <div className="record-heading">
        <strong>{tr(submissionStatusNames[submission.status])}</strong>
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
          <strong>{tr("Відгук перевірки")}</strong>
          <p className="preserve-lines">{submission.feedback}</p>
          <small>{formatDate(submission.reviewedAt, true)}</small>
        </div>
      )}
      {canReview && submission.status === "SUBMITTED" && (
        <SubmissionReviewForm
          submissionId={submission.id}
          onReviewed={onReviewed}
        />
      )}
    </article>
  );
}

// Форма, якою виконавець передає результат роботи на перевірку.
export function TaskSubmissionForm({
  task,
  onSubmitted,
}: {
  task: Task;
  onSubmitted: () => void;
}) {
  const { tr } = useLanguage();
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
      setError(tr("Опишіть результат роботи."));
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

  function addFile(file: FileAttachment) {
    setFiles((previous) => [...previous, file]);
  }

  function removeFile(fileId: string) {
    setFiles(files.filter((item) => item.id !== fileId));
  }

  return (
    <>
      <p className="form-note">
        {tr(
          "За потреби спочатку завантажте файли (до 10). Після передавання завдання перейде на перевірку.",
        )}
      </p>
      <FileUpload
        projectId={task.projectId}
        disabled={busy || files.length >= maxSubmissionFiles}
        onBusyChange={setUploading}
        onUploaded={addFile}
      />
      <ul className="record-list">
        {files.map((file) => (
          <li key={file.id}>
            <FileDownload file={file} />
            <button
              className="text-button"
              disabled={busy}
              onClick={() => removeFile(file.id)}
            >
              {tr("Не додавати до результату")}
            </button>
          </li>
        ))}
      </ul>
      <form className="work-form" onSubmit={submit}>
        <label htmlFor="submission-description">{tr("Опис результату")}</label>
        <textarea
          id="submission-description"
          required
          maxLength={10000}
          rows={5}
          value={description}
          disabled={busy}
          onChange={(event) => setDescription(event.target.value)}
        />
        <ErrorNotice message={error} />
        <button className="button primary" disabled={busy || uploading}>
          <i className="bi bi-send" aria-hidden="true"></i>
          {busy ? tr("Передаємо…") : tr("Передати на перевірку")}
        </button>
      </form>
    </>
  );
}

// Форма, якою власник проєкту приймає результат або повертає його на доопрацювання.
function SubmissionReviewForm({
  submissionId,
  onReviewed,
}: {
  submissionId: string;
  onReviewed: () => void;
}) {
  const { tr } = useLanguage();
  const [decision, setDecision] = useState("APPROVE");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!feedback.trim()) {
      setError(tr("Додайте відгук до рішення."));
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
        <label htmlFor={`decision-${submissionId}`}>{tr("Рішення")}</label>
        <select
          id={`decision-${submissionId}`}
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option value="APPROVE">{tr("Прийняти роботу")}</option>
          <option value="NEEDS_REVISION">
            {tr("Повернути на доопрацювання")}
          </option>
        </select>
        <label htmlFor={`feedback-${submissionId}`}>{tr("Відгук")}</label>
        <textarea
          id={`feedback-${submissionId}`}
          rows={3}
          required
          maxLength={5000}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
        />
        <ErrorNotice message={error} />
        <button className="button primary">
          {busy ? tr("Зберігаємо…") : tr("Зберегти рішення")}
        </button>
      </fieldset>
    </form>
  );
}
