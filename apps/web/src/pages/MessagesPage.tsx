import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { request, errorMessage, subscribe } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { projectStatusNames } from "../types";
import type { Project, ProjectMember, ProjectMessage } from "../types";

import { useLanguage } from "../i18n";
export function MessagesPage() {
  const { tr } = useLanguage();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const project = useApi<Project>(projectId ? `/projects/${projectId}` : null);
  // Лише проєкти, де користувач — замовник або учасник (навіть для адміністратора)
  const mine = useApi<Project[]>("/projects?mine=true&limit=50");
  return (
    <>
      <div className="page-heading">
        <h1>{tr("Повідомлення")}</h1>
        <p>{tr("Обговорення доступні лише учасникам відповідного проєкту.")}</p>
      </div>
      <div className="messenger">
        <nav className="data-panel messenger-list" aria-label={tr("Мої проєкти")}>
          <h2>{tr("Мої проєкти")}</h2>
          <ResourceState
            loading={mine.loading}
            error={mine.error}
            onRetry={mine.refresh}
          />
          {mine.data && !mine.data.length && (
            <p className="form-note">
              {tr("Ви ще не берете участі в жодному проєкті.")}
            </p>
          )}
          <ul>
            {mine.data?.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.id === projectId ? "true" : undefined}
                  onClick={() => setParams({ project: item.id })}
                >
                  <strong>{item.title}</strong>
                  <small>{tr(projectStatusNames[item.status])}</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="messenger-chat">
          {!projectId && (
            <div className="data-panel empty-state">
              <i className="bi bi-chat-dots" aria-hidden="true"></i>
              <h3>{tr("Оберіть проєкт зліва, щоб відкрити обговорення")}</h3>
            </div>
          )}
          <ResourceState
            loading={project.loading}
            error={project.error}
            onRetry={project.refresh}
          />
          {project.data && (
            <ProjectMessages key={projectId} project={project.data} />
          )}
        </div>
      </div>
    </>
  );
}

function ProjectMessages({ project }: { project: Project }) {
  const { tr } = useLanguage();
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
  // Нові повідомлення приходять одразу (SSE) і дописуються в кінець списку
  const [live, setLive] = useState<ProjectMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setLive([]), [messages.data]);
  useEffect(() => {
    if (page !== 1) return;
    const controller = new AbortController();
    void subscribe(
      `/projects/${project.id}/messages/stream`,
      (type, data) => {
        if (type !== "message") return;
        const message = JSON.parse(data) as ProjectMessage;
        setLive((list) =>
          list.some((item) => item.id === message.id)
            ? list
            : [...list, message],
        );
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [project.id, page]);
  const shown = messages.data
    ? [
        ...[...messages.data].reverse(),
        ...live.filter(
          (message) => !messages.data!.some((item) => item.id === message.id),
        ),
      ]
    : [];
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [shown.length]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!content.trim()) {
      setError(tr("Напишіть повідомлення."));
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
    if (id === user?.id) return user.name + tr(" (ви)");
    if (id === project.clientId) return tr("Клієнт проєкту");
    return (
      members.data?.find((member) => member.userId === id)?.user?.name ||
      tr("Користувач ") + id.slice(0, 8)
    );
  }
  return (
    <section className="data-panel">
      <div className="panel-heading">
        <div>
          <h2>{project.title}</h2>
          <span className="live-badge">
            <i aria-hidden="true"></i>
            {tr("Нові повідомлення з'являються одразу")}
          </span>
          <Link to={`/projects/${project.id}`}>{tr("До проєкту")}</Link>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            messages.refresh();
            members.refresh();
          }}
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

          {tr("Оновити повідомлення")}
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
          <div className="message-list padded" aria-live="polite" ref={listRef}>
            {!shown.length && (
              <p className="form-note">
                {tr("На цій сторінці повідомлень немає.")}
              </p>
            )}
            {shown.map((message) => (
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
            {tr(
              "Перша сторінка містить найновіші повідомлення. Наступні сторінки — раніші.",
            )}
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
            {tr("Проєкт закрито. Обговорення доступне для читання.")}
          </p>
        ) : (
          <form className="work-form" onSubmit={send}>
            <label htmlFor="message-content">{tr("Нове повідомлення")}</label>
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
              <i className="bi bi-send" aria-hidden="true"></i>
              {busy ? tr("Надсилаємо…") : tr("Надіслати повідомлення")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
