import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserAvatar } from "../components/UserAvatar";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import {
  request,
  errorMessage,
  subscribe,
  notificationsChangedEvent,
} from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
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
  // Відкрили листування — лічильник біля «Повідомлень» гасне
  useEffect(() => {
    if (user?.role === "ADMIN") return;
    void request("/notifications/read-messages", { method: "POST" })
      .then(() => window.dispatchEvent(new Event(notificationsChangedEvent)))
      .catch(() => {});
  }, [user?.role, projectId, applicationId]);
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
      {/* На телефоні видно або список розмов, або відкритий чат — не обидва одразу */}
      <div
        className={
          projectId || applicationId ? "messenger chat-open" : "messenger"
        }
      >
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
          <button
            type="button"
            className="link-button messenger-back"
            onClick={() => setParams({})}
          >
            <i className="bi bi-arrow-left" aria-hidden="true"></i>
            {tr("Усі розмови")}
          </button>
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
      title={tr(
        "Заявка на «{0}» · {1}",
        chat.projectTitle,
        tr(applicationStatusNames[chat.status]),
      )}
      link={
        chat.status === "ACCEPTED"
          ? {
              to: `/messages?project=${chat.projectId}`,
              label: tr("Перейти в чат проєкту"),
            }
          : isClient
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

const pageSize = 30;

// Спільний чат: одна стрічка з прокруткою. Найновіші — внизу, старіші догружаються,
// коли гортаєш угору; нові повідомлення приходять наживо через SSE
function Chat({
  path,
  title,
  link,
  readOnly,
  senderName,
  extra,
  onSent,
}: {
  path: string;
  title: string;
  link: { to: string; label: string };
  readOnly: string;
  senderName: (id: string) => string;
  extra?: { loading: boolean; error: string; refresh: () => void };
  onSent?: () => void;
}) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const latest = useApi<ProjectMessage[]>(
    `${path}/messages?page=1&limit=${pageSize}`,
  );
  // Раніші сторінки, які вже догрузили прокруткою вгору
  const [older, setOlder] = useState<ProjectMessage[]>([]);
  const [olderPage, setOlderPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState("");
  const [content, setContent] = useState("");
  // Надіслане, але ще не підтверджене сервером: показуємо одразу, як у чаті Ади
  const [sending, setSending] = useState("");
  const [error, setError] = useState("");
  const [live, setLive] = useState<ProjectMessage[]>([]);
  // Видалені (собою чи співрозмовником) — ховаємо зі стрічки без перезавантаження
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Висота стрічки перед догрузкою старіших: після неї повертаємо читача на те саме місце
  const keepScroll = useRef<number | null>(null);
  // Хто зараз пише: id → ім'я; кожен запис гасне через 5 с без нової події
  const [typers, setTypers] = useState<Record<string, string>>({});
  const typerTimers = useRef<Record<string, number>>({});
  const lastTyping = useRef(0);
  function stopTyping(id: string) {
    window.clearTimeout(typerTimers.current[id]);
    delete typerTimers.current[id];
    setTypers((list) => {
      if (!(id in list)) return list;
      const rest = { ...list };
      delete rest[id];
      return rest;
    });
  }
  useEffect(() => {
    if (latest.data) setHasMore(latest.data.length === pageSize);
  }, [latest.data]);
  useEffect(() => {
    const controller = new AbortController();
    void subscribe(
      `${path}/messages/stream`,
      (type, data) => {
        if (type === "typing") {
          const { userId, name } = JSON.parse(data) as {
            userId: string;
            name: string;
          };
          setTypers((list) => ({ ...list, [userId]: name }));
          window.clearTimeout(typerTimers.current[userId]);
          typerTimers.current[userId] = window.setTimeout(
            () => stopTyping(userId),
            5000,
          );
          return;
        }
        if (type === "deleted") {
          const { id } = JSON.parse(data) as { id: string };
          setRemoved((set) => new Set(set).add(id));
          return;
        }
        if (type !== "message") return;
        const message = JSON.parse(data) as ProjectMessage;
        stopTyping(message.senderId);
        setLive((list) => [...list, message]);
      },
      controller.signal,
    );
    const timers = typerTimers.current;
    return () => {
      controller.abort();
      Object.values(timers).forEach((timer) => window.clearTimeout(timer));
      setTypers({});
    };
  }, [path]);
  // Сторінки рахуються від найновішого, тож нові повідомлення зсувають їх і дають дублікати — відсіюємо за id
  const seen = new Set<string>();
  const shown = [
    ...[...older].reverse(),
    ...[...(latest.data ?? [])].reverse(),
    ...live,
  ].filter(
    (message) =>
      !removed.has(message.id) && !seen.has(message.id) && seen.add(message.id),
  );
  const newestId = shown.at(-1)?.id;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (keepScroll.current !== null) {
      list.scrollTop = list.scrollHeight - keepScroll.current;
      keepScroll.current = null;
    } else list.scrollTop = list.scrollHeight;
  }, [shown.length, newestId, sending]);
  // Fallback для браузерів без field-sizing: висота поля за вмістом (межу ставить max-height у CSS)
  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field || CSS.supports("field-sizing", "content")) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [content]);

  async function loadOlder() {
    if (!hasMore || loadingOlder || !latest.data) return;
    setLoadingOlder(true);
    setOlderError("");
    try {
      const page = await request<ProjectMessage[]>(
        `${path}/messages?page=${olderPage + 1}&limit=${pageSize}`,
      );
      keepScroll.current = listRef.current
        ? listRef.current.scrollHeight - listRef.current.scrollTop
        : null;
      setOlder((list) => [...list, ...page]);
      setOlderPage((value) => value + 1);
      setHasMore(page.length === pageSize);
    } catch (error) {
      setOlderError(errorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }
  async function remove(message: ProjectMessage) {
    if (
      !window.confirm(tr("Видалити це повідомлення? Його не побачить ніхто."))
    )
      return;
    setError("");
    try {
      await request(`${path}/messages/${message.id}`, { method: "DELETE" });
      setRemoved((set) => new Set(set).add(message.id));
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  // Ім'я від сервера; для старих записів — підказка зі сторінки
  const author = (message: ProjectMessage) =>
    message.senderId === user?.id
      ? tr("Ви")
      : message.senderName || senderName(message.senderId);
  function refresh() {
    setOlder([]);
    setOlderPage(1);
    setLive([]);
    latest.refresh();
    extra?.refresh();
  }
  // Сповіщаємо співрозмовників, що пишемо, не частіше ніж раз на 2,5 с
  function typed(value: string) {
    setContent(value);
    if (!value.trim() || Date.now() - lastTyping.current < 2500) return;
    lastTyping.current = Date.now();
    void request(`${path}/typing`, { method: "POST" }).catch(() => {});
  }
  const typerNames = Object.values(typers);
  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (sending) return;
    setError("");
    const text = content.trim();
    if (!text) {
      setError(tr("Напишіть повідомлення."));
      return;
    }
    // Поле очищуємо одразу — повідомлення вже видно в стрічці; при збої повертаємо текст
    setSending(text);
    setContent("");
    try {
      const saved = await request<ProjectMessage>(`${path}/messages`, {
        method: "POST",
        body: { content: text },
      });
      lastTyping.current = 0;
      if (saved?.id) setLive((list) => [...list, saved]);
      else refresh();
      onSent?.();
    } catch (error) {
      setContent(text);
      setError(errorMessage(error));
    } finally {
      setSending("");
    }
  }
  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void send();
  }
  const loading = latest.loading || Boolean(extra?.loading);
  const loadError = latest.error || extra?.error || "";
  return (
    <section className="data-panel chat-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <span className="live-badge">
            <i aria-hidden="true"></i>
            {tr("Нові повідомлення з'являються одразу")}
          </span>
          <Link to={link.to}>{link.label}</Link>
        </div>
        <button
          type="button"
          className="icon-action"
          aria-label={tr("Оновити повідомлення")}
          title={tr("Оновити повідомлення")}
          onClick={refresh}
        >
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
        </button>
      </div>
      <ResourceState loading={loading} error={loadError} onRetry={refresh} />
      {latest.data && !loading && !loadError && (
        <div
          className="message-list padded"
          aria-live="polite"
          ref={listRef}
          onScroll={(event) => {
            if (event.currentTarget.scrollTop < 80) void loadOlder();
          }}
        >
          {hasMore && (
            <p className="message-history-note" role="status">
              {loadingOlder ? (
                tr("Завантажуємо раніші повідомлення…")
              ) : olderError ? (
                <>
                  {olderError}{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void loadOlder()}
                  >
                    {tr("Спробувати ще раз")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void loadOlder()}
                >
                  {tr("Показати раніші повідомлення")}
                </button>
              )}
            </p>
          )}
          {!shown.length && !sending && (
            <p className="form-note">{tr("Повідомлень ще немає.")}</p>
          )}
          {shown.map((message) => {
            const own = message.senderId === user?.id;
            return (
              <article
                className={own ? "message own" : "message"}
                key={message.id}
              >
                {!own && (
                  <UserAvatar
                    name={author(message)}
                    avatarUrl={message.senderAvatarUrl}
                    size="small"
                  />
                )}
                <div className="message-bubble">
                  <div className="record-heading">
                    <strong>{author(message)}</strong>
                    <time dateTime={message.createdAt}>
                      {formatDate(message.createdAt, true)}
                    </time>
                  </div>
                  <p className="preserve-lines">{message.content}</p>
                </div>
                {own && (
                  <button
                    type="button"
                    className="message-delete"
                    aria-label={tr("Видалити повідомлення")}
                    title={tr("Видалити повідомлення")}
                    onClick={() => void remove(message)}
                  >
                    <i className="bi bi-trash3" aria-hidden="true"></i>
                  </button>
                )}
              </article>
            );
          })}
          {sending && (
            <article className="message own pending">
              <div className="message-bubble">
                <div className="record-heading">
                  <strong>{tr("Ви")}</strong>
                  <small>{tr("Надсилаємо…")}</small>
                </div>
                <p className="preserve-lines">{sending}</p>
              </div>
            </article>
          )}
        </div>
      )}
      <p className="typing-indicator padded" aria-live="polite">
        {typerNames.length > 0 && (
          <>
            <span className="typing-dots" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            {tr(
              typerNames.length > 1 ? "{0} пишуть…" : "{0} пише…",
              typerNames.join(", "),
            )}
          </>
        )}
      </p>
      <div className="chat-composer">
        {readOnly ? (
          <p className="form-note">{readOnly}</p>
        ) : (
          <form onSubmit={(event) => void send(event)}>
            <label htmlFor="message-content" className="visually-hidden">
              {tr("Нове повідомлення")}
            </label>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="ai-composer">
              <textarea
                ref={textarea}
                id="message-content"
                rows={1}
                required
                maxLength={5000}
                placeholder={tr("Напишіть повідомлення…")}
                value={content}
                onChange={(event) => typed(event.target.value)}
                onKeyDown={handleKey}
              />
              <div className="ai-composer-bar">
                <span className="ai-hint">
                  {tr("Enter — надіслати, Shift+Enter — новий рядок")}
                </span>
                <button
                  className="ai-send"
                  disabled={Boolean(sending) || !content.trim()}
                  aria-label={tr("Надіслати повідомлення")}
                  title={tr("Надіслати повідомлення")}
                >
                  <i className="bi bi-arrow-up" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
