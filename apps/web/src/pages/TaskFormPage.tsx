import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { ResourceState } from "../components/ResourceState";
import { toDateTimeInput } from "../format";
import { priorityNames } from "../types";
import type { Project, ProjectMember, Task } from "../types";

import { useLanguage } from "../i18n";
export function TaskFormPage() {
  const { id, taskId } = useParams();
  const task = useApi<Task>(taskId ? `/tasks/${taskId}` : null);
  if (taskId && !task.data)
    return (
      <ResourceState
        loading={task.loading}
        error={task.error}
        onRetry={task.refresh}
      />
    );
  const projectId = task.data?.projectId || id;
  if (!projectId) return null;
  return (
    <TaskFormContext
      key={taskId || projectId}
      projectId={projectId}
      task={task.data}
    />
  );
}

function TaskFormContext({
  projectId,
  task,
}: {
  projectId: string;
  task: Task | null;
}) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const project = useApi<Project>(`/projects/${projectId}`);
  const members = useApi<ProjectMember[]>(`/projects/${projectId}/members`);
  if (!project.data || !members.data)
    return (
      <ResourceState
        loading={project.loading || members.loading}
        error={project.error || members.error}
        onRetry={() => {
          project.refresh();
          members.refresh();
        }}
      />
    );
  if (
    (user?.role !== "ADMIN" && project.data.clientId !== user?.id) ||
    ["COMPLETED", "CANCELLED"].includes(project.data.status) ||
    (task && ["REVIEW", "DONE"].includes(task.status))
  )
    return (
      <section className="account-panel">
        <h1>{tr("Редагування недоступне")}</h1>
        <p>{tr("Перевірте права та поточний стан проєкту й завдання.")}</p>
        <Link to={`/projects/${projectId}`}>{tr("До проєкту")}</Link>
      </section>
    );
  return <TaskForm project={project.data} members={members.data} task={task} />;
}

function TaskForm({
  project,
  members,
  task,
}: {
  project: Project;
  members: ProjectMember[];
  task: Task | null;
}) {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || "");
  const [priority, setPriority] = useState<Task["priority"]>(
    task?.priority || "MEDIUM",
  );
  const [deadline, setDeadline] = useState(
    toDateTimeInput(task?.deadline || null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (title.trim().length < 2) {
      setError(tr("Назва має містити щонайменше 2 символи."));
      return;
    }
    if (deadline && Number.isNaN(new Date(deadline).getTime())) {
      setError(tr("Перевірте дату дедлайну."));
      return;
    }
    if (
      deadline &&
      project.deadline &&
      new Date(deadline) > new Date(project.deadline)
    ) {
      setError(
        tr("Дедлайн завдання не може бути пізнішим за дедлайн проєкту."),
      );
      return;
    }
    setBusy(true);
    try {
      const body: {
        title: string;
        description: string;
        priority: Task["priority"];
        assigneeId?: string | null;
        deadline?: string | null;
      } = { title: title.trim(), description, priority };
      if (assigneeId !== (task?.assigneeId || ""))
        body.assigneeId = assigneeId || null;
      if (deadline !== toDateTimeInput(task?.deadline || null))
        body.deadline = deadline ? new Date(deadline).toISOString() : null;
      const result = await request<{ id: string }>(
        task ? `/tasks/${task.id}` : `/projects/${project.id}/tasks`,
        { method: task ? "PATCH" : "POST", body },
      );
      await navigate(`/tasks/${task?.id || result.id}`, { replace: true });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        className="breadcrumb"
        to={task ? `/tasks/${task.id}` : `/projects/${project.id}`}
      >
        {tr("← Повернутися")}
      </Link>
      <div className="page-heading">
        <h1>{task ? tr("Редагувати завдання") : tr("Створити завдання")}</h1>
        <p>{project.title}</p>
      </div>
      <section className="data-panel project-form-panel">
        <form onSubmit={submit}>
          <fieldset className="form-fields work-form" disabled={busy}>
            <label htmlFor="task-title">{tr("Назва завдання")}</label>
            <input
              id="task-title"
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label htmlFor="task-description">{tr("Опис завдання")}</label>
            <textarea
              id="task-description"
              rows={5}
              maxLength={10000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <label htmlFor="task-assignee">{tr("Виконавець")}</label>
            <select
              id="task-assignee"
              disabled={task?.status === "IN_PROGRESS"}
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              <option value="">{tr("Не призначено")}</option>
              {members
                .filter((member) => member.user?.role === "FREELANCER")
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.name} — {member.user?.email}
                  </option>
                ))}
            </select>
            <p className="form-note">
              {tr(
                "Виконавця спочатку потрібно додати до учасників проєкту. Під час виконання змінити виконавця не можна.",
              )}
            </p>
            <label htmlFor="task-form-priority">{tr("Пріоритет")}</label>
            <select
              id="task-form-priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as Task["priority"])
              }
            >
              {Object.entries(priorityNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              ))}
            </select>
            <label htmlFor="task-form-deadline">{tr("Дедлайн завдання")}</label>
            <input
              id="task-form-deadline"
              type="datetime-local"
              step="1"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
            <p className="form-note">
              {tr(
                "Час місцевий. Дедлайн не може бути пізнішим за дедлайн проєкту.",
              )}
            </p>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="page-actions">
              <button className="button primary" type="submit">
                {busy ? tr("Зберігаємо…") : tr("Зберегти завдання")}
              </button>
              {!busy && (
                <Link
                  className="button secondary"
                  to={task ? `/tasks/${task.id}` : `/projects/${project.id}`}
                >
                  {tr("Скасувати")}
                </Link>
              )}
            </div>
          </fieldset>
        </form>
      </section>
    </>
  );
}
