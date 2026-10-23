import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { ProjectPicker } from "../components/ProjectPicker";
import { Pagination, ResourceState } from "../components/ResourceState";
import type { Project, ProjectMember, ProjectMessage } from "../types";

export function MessagesPage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const project = useApi<Project>(projectId ? `/projects/${projectId}` : null);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / КОМАНДА</span>
        <h1>Повідомлення</h1>
        <p>Обговорення доступні лише учасникам відповідного проєкту.</p>
      </div>
      <ProjectPicker
        value={projectId}
        selected={project.data}
        onChange={(value) => setParams(value ? { project: value } : {})}
      />
      <ResourceState
        loading={project.loading}
        error={project.error}
        onRetry={project.refresh}
      />
      {project.data && (
        <ProjectMessages key={projectId} project={project.data} />
      )}
    </>
  );
}

function ProjectMessages({ project }: { project: Project }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const messages = useApi<ProjectMessage[]>(
    `/projects/${project.id}/messages?page=${page}&limit=20`,
  );
  const members = useApi<ProjectMember[]>(`/projects/${project.id}/members`);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closed = ["COMPLETED", "CANCELLED"].includes(project.status);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!content.trim()) {
      setError("Напишіть повідомлення.");
      return;
    }
    setBusy(true);
    try {
      await request(`/projects/${project.id}/messages`, {
        method: "POST",
        body: { content: content.trim() },
      });
      setContent("");
      setParams({ project: project.id });
      messages.refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function senderName(id: string) {
    if (id === user?.id) return user.name + " (ви)";
    if (id === project.clientId) return "Клієнт проєкту";
    return (
      members.data?.find((member) => member.userId === id)?.user?.name ||
      "Користувач " + id.slice(0, 8)
    );
  }
  return (
    <section className="data-panel section-gap">
      <div className="panel-heading">
        <div>
          <h2>{project.title}</h2>
          <Link to={`/projects/${project.id}`}>До проєкту</Link>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            messages.refresh();
            members.refresh();
          }}
        >
          Оновити повідомлення
        </button>
      </div>
      <ResourceState
        loading={messages.loading || members.loading}
        error={messages.error || members.error}
        onRetry={() => {
          messages.refresh();
          members.refresh();
        }}
      />
      {messages.data && !members.loading && !members.error && (
        <>
          <div className="message-list padded" aria-live="polite">
            {!messages.data.length && (
              <p className="form-note">На цій сторінці повідомлень немає.</p>
            )}
            {[...messages.data].reverse().map((message) => (
              <article
                className={
                  message.senderId === user?.id ? "message own" : "message"
                }
                key={message.id}
              >
                <div className="record-heading">
                  <strong>{senderName(message.senderId)}</strong>
                  <time dateTime={message.createdAt}>
                    {formatDate(message.createdAt, true)}
                  </time>
                </div>
                <p className="preserve-lines">{message.content}</p>
              </article>
            ))}
          </div>
          <p className="form-note padded">
            Перша сторінка містить найновіші повідомлення. Наступні сторінки —
            раніші.
          </p>
          <Pagination
            page={page}
            count={messages.data.length}
            onChange={(value) =>
              setParams({ project: project.id, page: String(value) })
            }
          />
        </>
      )}
      <div className="padded">
        {closed ? (
          <p className="form-note">
            Проєкт закрито. Обговорення доступне для читання.
          </p>
        ) : (
          <form className="work-form" onSubmit={send}>
            <label htmlFor="message-content">Нове повідомлення</label>
            <textarea
              id="message-content"
              required
              maxLength={5000}
              rows={4}
              value={content}
              disabled={busy}
              onChange={(event) => setContent(event.target.value)}
            />
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Надсилаємо…" : "Надіслати повідомлення"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
