import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { request, errorMessage, subscribe } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate, parsePage } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { applicationStatusNames, projectStatusNames } from "../types";
import type {
  ApplicationChat,
  Project,
  ProjectMember,
  ProjectMessage,
} from "../types";

import { useLanguage } from "../i18n";
export function MessagesPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const applicationId = projectId ? "" : params.get("application") || "";
  const project = useApi<Project>(projectId ? `/projects/${projectId}` : null);
  const application = useApi<ApplicationChat>(
    applicationId ? `/applications/${applicationId}/chat` : null,
  );
  // Лише проєкти, де користувач — замовник або учасник (навіть для адміністратора)
  const mine = useApi<Project[]>("/projects?mine=true&limit=50");
  const chats = useApi<ApplicationChat[]>(
    user?.role === "ADMIN" ? null : "/applications/conversations",
  );
  const current = project.data ? project : application;
  return (
    <>
      <div className="page-heading">
        <h1>{tr("Повідомлення")}</h1>
        <p>
          {tr(
            "Обговорення проєктів доступні лише учасникам, а переписка щодо заявки — клієнту й автору заявки.",
          )}
        </p>
      </div>
      <div className="messenger">
        <nav className="data-panel messenger-list" aria-label={tr("Розмови")}>
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
          {!!chats.data?.length && (
            <>
              <h2>{tr("Заявки")}</h2>
              <ul>
                {chats.data.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={
                        item.id === applicationId ? "true" : undefined
                      }
                      onClick={() => setParams({ application: item.id })}
                    >
                      <strong>
                        {user?.id === item.clientId
                          ? item.freelancerName
                          : item.clientName}
                      </strong>
                      <small>{item.projectTitle}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <div className="messenger-chat">
          {!projectId && !applicationId && (
            <div className="data-panel empty-state">
              <i className="bi bi-chat-dots" aria-hidden="true"></i>
              <h3>{tr("Оберіть розмову зліва")}</h3>
            </div>
          )}
          <ResourceState
            loading={current.loading}
            error={current.error}
            onRetry={current.refresh}
          />
          {project.data && (
            <ProjectMessages key={projectId} project={project.data} />
          )}
          {application.data && (
            <ApplicationMessages
              key={applicationId}
              chat={application.data}
              onFirstMessage={chats.refresh}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ProjectMessages({ project }: { project: Project }) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const members = useApi<ProjectMember[]>(`/projects/${project.id}/members`);
  return (
    <Chat
      path={`/projects/${project.id}`}
      param={{ project: project.id }}
      title={project.title}
      link={{ to: `/projects/${project.id}`, label: tr("До проєкту") }}
      readOnly={
        ["COMPLETED", "CANCELLED"].includes(project.status)
          ? tr("Проєкт закрито. Обговорення доступне для читання.")
          : ""
      }
      extra={members}
      senderName={(id) => {
        if (id === user?.id) return user.name + tr(" (ви)");
        if (id === project.clientId) return tr("Клієнт проєкту");
        return (
          members.data?.find((member) => member.userId === id)?.user?.name ||
          tr("Користувач ") + id.slice(0, 8)
        );
      }}
    />
  );
}

function ApplicationMessages({
  chat,
  onFirstMessage,
}: {
  chat: ApplicationChat;
  onFirstMessage: () => void;
}) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const isClient = user?.id === chat.clientId;
  const readOnly =
    chat.status === "ACCEPTED"
      ? tr("Фрілансера прийнято до команди — продовжуйте в чаті проєкту.")
      : chat.status === "REJECTED"
        ? tr("Заявку відхилено. Переписка доступна для читання.")
        : "";
  return (
    <Chat
      path={`/applications/${chat.id}`}
      param={{ application: chat.id }}
      title={tr(
        "Заявка на «{0}» · {1}",
        chat.projectTitle,
        tr(applicationStatusNames[chat.status]),
      )}
      link={
        isClient
          ? {
              to: `/projects/${chat.projectId}/applications`,
              label: tr("До заявок"),
            }
          : { to: "/marketplace", label: tr("До біржі") }
      }
      readOnly={readOnly}
      onSent={onFirstMessage}
      senderName={(id) =>
        id === user?.id
          ? (user?.name ?? "") + tr(" (ви)")
          : (id === chat.clientId ? chat.clientName : chat.freelancerName) ||
            tr("Користувач ") + id.slice(0, 8)
      }
    />
  );
}

// Спільний чат: історія сторінками, нові повідомлення наживо через SSE
function Chat({
  path,
  param,
  title,
  link,
  readOnly,
  senderName,
  extra,
  onSent,
}: {
  path: string;
  param: Record<string, string>;
  title: string;
  link: { to: string; label: string };
  readOnly: string;
  senderName: (id: string) => string;
  extra?: { loading: boolean; error: string; refresh: () => void };
  onSent?: () => void;
}) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const messages = useApi<ProjectMessage[]>(
    `${path}/messages?page=${page}&limit=20`,
  );
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState<ProjectMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setLive([]), [messages.data]);
  useEffect(() => {
    if (page !== 1) return;
    const controller = new AbortController();
    void subscribe(
      `${path}/messages/stream`,
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
  }, [path, page]);
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
  function refresh() {
    messages.refresh();
    extra?.refresh();
  }
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
      await request(`${path}/messages`, {
        method: "POST",
        body: { content: content.trim() },
      });
      setContent("");
      setParams(param);
      messages.refresh();
      onSent?.();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const loading = messages.loading || Boolean(extra?.loading);
  const loadError = messages.error || extra?.error || "";
  return (
    <section className="data-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span className="live-badge">
            <i aria-hidden="true"></i>
            {tr("Нові повідомлення з'являються одразу")}
          </span>
          <Link to={link.to}>{link.label}</Link>
        </div>
        <button className="button secondary" onClick={refresh}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

          {tr("Оновити повідомлення")}
        </button>
      </div>
      <ResourceState loading={loading} error={loadError} onRetry={refresh} />
      {messages.data && !loading && !loadError && (
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
            onChange={(value) => setParams({ ...param, page: String(value) })}
          />
        </>
      )}
      <div className="padded">
        {readOnly ? (
          <p className="form-note">{readOnly}</p>
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
