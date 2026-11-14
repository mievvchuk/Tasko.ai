import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { useNavigate } from "react-router";
import { aiName, aiToolNames, useAiChat } from "../aiChat";
import type { AiAttachment, AiProjectDraft } from "../aiChat";
import { formatDate } from "../format";
import type { UserRole } from "../types";

import { useLanguage } from "../i18n";
const MarkdownAnswer = lazy(() => import("./MarkdownAnswer"));

// Ті самі ліміти, що й на сервері (agent/attachments.ts)
const maxFiles = 3;
const maxFileSize = 5 * 1024 * 1024;

// Готові запитання-підказки під роль користувача
const suggestions: Record<UserRole, string[]> = {
  CLIENT: [
    "Підсумуй стан моїх проєктів",
    "Допоможи створити новий проєкт",
    "Які завдання прострочені або під ризиком?",
    "Чи є нові заявки на мої проєкти?",
  ],
  FREELANCER: [
    "Що мені зробити першим сьогодні?",
    "Які мої найближчі дедлайни?",
    "Знайди відкриті проєкти на біржі",
    "Які в мене непрочитані сповіщення?",
  ],
  ADMIN: [
    "Покажи загальну статистику",
    "Які проєкти мають прострочені завдання?",
    "Хто з виконавців найбільш завантажений?",
    "Які завдання чекають на перевірку?",
  ],
};

// Фрази, що змінюють одна одну, поки Ада готує відповідь
const thinkingSteps = [
  "Думаю над запитанням",
  "Переглядаю ваші проєкти",
  "Перевіряю завдання й дедлайни",
  "Зіставляю дані",
  "Формую відповідь",
];

function Thinking() {
  const { tr } = useLanguage();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setStep((current) => (current + 1) % thinkingSteps.length),
      2200,
    );
    return () => clearInterval(timer);
  }, []);
  // Скрінрідер чує один статус, а не кожну зміну фрази
  return (
    <div className="ai-reply ai-thinking" role="status">
      <span className="ai-avatar" aria-hidden="true">
        <i className="bi bi-stars"></i>
      </span>
      <span className="visually-hidden">
        {tr(aiName)} {tr("аналізує дані")}
      </span>
      <span className="ai-bubble bot" aria-hidden="true">
        <span key={step} className="ai-thinking-text">
          {tr(thinkingSteps[step])}
        </span>
        <span className="ai-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
  );
}

function UserBubble({ question, files }: { question: string; files?: string[] }) {
  const { tr } = useLanguage();
  return (
    <div className="ai-bubble user">
      <h2 className="visually-hidden">{tr("Ваше запитання")}</h2>
      <p className="preserve-lines ai-question">{question}</p>
      {files && files.length > 0 && (
        <ul className="ai-files" aria-label={tr("Прикріплені файли")}>
          {files.map((name) => (
            <li key={name}>
              <i className="bi bi-paperclip" aria-hidden="true"></i>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Чернетка від Ади: проєкт створює сам клієнт через звичайний POST /projects
function ProjectDraftCard({ draft }: { draft: AiProjectDraft }) {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const project = await request<{ id: string }>("/projects", {
        method: "POST",
        body: draft,
      });
      await navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <section className="ai-draft" aria-label={tr("Чернетка проєкту")}>
      <h3>{draft.title}</h3>
      <p className="preserve-lines">{draft.description}</p>
      <dl>
        <div>
          <dt>{tr("Бюджет")}</dt>
          <dd>
            {draft.budgetMin !== undefined || draft.budgetMax !== undefined
              ? tr(
                  "{0}–{1} грн",
                  draft.budgetMin ?? 0,
                  draft.budgetMax ?? "необмежено",
                )
              : tr("Не вказано")}
          </dd>
        </div>
        <div>
          <dt>{tr("Дедлайн")}</dt>
          <dd>{formatDate(draft.deadline ?? null)}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="button primary"
        disabled={busy}
        onClick={() => void create()}
      >
        {busy ? tr("Створюємо…") : tr("Створити проєкт")}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

// Розмова з AI-агентом: на сторінці /ai (variant="page") і в бічній панелі (variant="panel")
export function AiConversation({
  variant,
  context,
  configured,
}: {
  variant: "page" | "panel";
  context?: string;
  configured: boolean;
}) {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const { exchanges, pending, busy, error, send, cancel } = useAiChat();
  const [message, setMessage] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Fallback для браузерів без field-sizing: висота за вмістом (межу ставить max-height у CSS)
  useLayoutEffect(() => {
    const field = textarea.current;
    if (!field || CSS.supports("field-sizing", "content")) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [message]);
  // Нове запитання чи відповідь — гортаємо стрічку донизу, щоб їх було видно
  const history = useRef<HTMLDivElement>(null);
  useEffect(() => {
    history.current?.scrollTo({ top: history.current.scrollHeight });
  }, [exchanges.length, pending]);
  const [localError, setLocalError] = useState("");
  // Матеріали до наступного запитання: сервер уже витягнув із них текст
  const [files, setFiles] = useState<AiAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = `ai-message-${variant}`;
  const locked = busy || reading || !configured;
  const unasked = user
    ? suggestions[user.role]
        .map((text) => tr(text))
        .filter((text) => !exchanges.some((item) => item.question === text))
    : [];

  async function ask(question: string) {
    setLocalError("");
    if (!question.trim()) {
      setLocalError(tr("Напишіть запитання."));
      return;
    }
    // Поле очищуємо одразу — запитання вже видно в стрічці; при збої повертаємо текст і файли
    const sentFiles = files;
    setMessage("");
    setFiles([]);
    if (!(await send(question.trim(), context, sentFiles))) {
      setMessage(question);
      setFiles(sentFiles);
    }
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!chosen.length) return;
    setLocalError("");
    if (files.length + chosen.length > maxFiles) {
      setLocalError(tr("Можна прикріпити до {0} файлів.", maxFiles));
      return;
    }
    if (chosen.some((file) => file.size > maxFileSize)) {
      setLocalError(tr("Кожен файл має бути до 5 МБ."));
      return;
    }
    const body = new FormData();
    for (const file of chosen) body.append("files", file);
    setReading(true);
    try {
      const added = await request<AiAttachment[]>("/agent/attachments", {
        method: "POST",
        body,
        timeoutMs: 60000,
      });
      setFiles((current) => [...current, ...added]);
    } catch (e) {
      setLocalError(errorMessage(e));
    } finally {
      setReading(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!locked) void ask(message);
  }
  // Enter надсилає, Shift+Enter — новий рядок (як у месенджерах)
  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!locked) void ask(message);
  }

  return (
    <div className={`ai-conversation ${variant}`}>
      <div className="ai-history" aria-live="polite" ref={history}>
        {!exchanges.length && !busy && variant === "panel" && (
          <div className="ai-welcome">
            <span className="ai-avatar" aria-hidden="true">
              <i className="bi bi-stars"></i>
            </span>
            <div>
              <strong>
                {tr("Привіт! Я")} {tr(aiName)}.
              </strong>
              <p>{tr("Запитайте про проєкти, завдання чи дедлайни.")}</p>
            </div>
          </div>
        )}
        {exchanges.map((item, index) => (
          <article
            key={index}
            className={item.offTopic ? "ai-exchange off-topic" : "ai-exchange"}
          >
            <UserBubble question={item.question} files={item.files} />
            <div className="ai-reply">
              <span className="ai-avatar" aria-hidden="true">
                <i className="bi bi-stars"></i>
              </span>
              <div className="ai-bubble bot">
                <h2 className="ai-reply-name">{tr(aiName)}</h2>
                <Suspense
                  fallback={<p role="status">{tr("Форматуємо відповідь…")}</p>}
                >
                  <MarkdownAnswer>{item.answer}</MarkdownAnswer>
                </Suspense>
                {item.projectDraft && (
                  <ProjectDraftCard draft={item.projectDraft} />
                )}
                {item.toolsUsed.length > 0 && (
                  <p className="ai-sources">
                    <i className="bi bi-database" aria-hidden="true"></i>
                    {[...new Set(item.toolsUsed)]
                      .map((name) => tr(aiToolNames[name] || "Дані проєкту"))
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
        {pending && (
          <article className="ai-exchange">
            <UserBubble question={pending.question} files={pending.files} />
            <Thinking />
          </article>
        )}
      </div>
      {/* Підказки лишаються й після першого запитання (без уже заданих), щоб було видно, що ще вміє Ада */}
      {!busy && user && configured && unasked.length > 0 && (
        <div
          className={
            exchanges.length ? "ai-suggestions compact" : "ai-suggestions"
          }
          role="group"
          aria-label={tr("Спробуйте запитати")}
        >
          {!exchanges.length && (
            <p className="form-note" aria-hidden="true">
              {tr("Спробуйте запитати")}
            </p>
          )}
          {unasked.map((text) => (
              <button
                key={text}
                type="button"
                className="ai-chip"
                onClick={() => void ask(text)}
              >
                <span>{text}</span>
                <i className="bi bi-arrow-up-right" aria-hidden="true"></i>
              </button>
            ))}
        </div>
      )}
      <form className="work-form ai-form" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          {tr("Запитання до Ади")}
        </label>
        {files.length > 0 && (
          <ul className="ai-files" aria-label={tr("Файли до запитання")}>
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <i className="bi bi-file-earmark-text" aria-hidden="true"></i>
                {file.name}
                {file.truncated && <small>{tr("обрізано")}</small>}
                <button
                  type="button"
                  aria-label={tr("Прибрати файл {0}", file.name)}
                  disabled={busy}
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <i className="bi bi-x" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="ai-composer">
          <textarea
            ref={textarea}
            id={inputId}
            rows={1}
            required
            maxLength={1800}
            placeholder={tr("Напишіть повідомлення…")}
            value={message}
            disabled={busy || !configured}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleKey}
          />
          <div className="ai-composer-bar">
            <button
              type="button"
              className="ai-icon-button"
              disabled={locked || files.length >= maxFiles}
              aria-label={tr("Прикріпити файл")}
              title={tr(
                "Прикріпити файл: TXT, PDF або DOCX, до 5 МБ, не більше 3",
              )}
              onClick={() => fileInput.current?.click()}
            >
              <i className="bi bi-paperclip" aria-hidden="true"></i>
            </button>
            <span className="ai-hint">
              {tr("Enter — надіслати, Shift+Enter — новий рядок")}
            </span>
            {busy ? (
              <button
                type="button"
                className="ai-send"
                aria-label={tr("Скасувати запит")}
                title={tr("Скасувати запит")}
                onClick={cancel}
              >
                <i className="bi bi-stop-fill" aria-hidden="true"></i>
              </button>
            ) : (
              <button
                className="ai-send"
                disabled={locked || !message.trim()}
                aria-label={tr("Надіслати запит")}
                title={tr("Надіслати запит")}
              >
                <i className="bi bi-arrow-up" aria-hidden="true"></i>
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInput}
          id={`ai-files-${variant}`}
          className="visually-hidden"
          type="file"
          multiple
          accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={locked}
          onChange={(event) => void attach(event)}
        />
        {reading && (
          <p role="status" className="form-note">
            {tr("Читаємо файл…")}
          </p>
        )}
        {(localError || error) && (
          <p className="notice error" role="alert">
            {localError || error}
          </p>
        )}
      </form>
    </div>
  );
}
