import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { aiName, aiToolNames, useAiChat } from "../aiChat";
import type { AiAttachment } from "../aiChat";
import type { UserRole } from "../types";

const MarkdownAnswer = lazy(() => import("./MarkdownAnswer"));

// Ті самі ліміти, що й на сервері (agent/attachments.ts)
const maxFiles = 3;
const maxFileSize = 5 * 1024 * 1024;

// Готові запитання-підказки під роль користувача
const suggestions: Record<UserRole, string[]> = {
  CLIENT: [
    "Підсумуй стан моїх проєктів",
    "Які завдання прострочені або під ризиком?",
    "Чи є нові заявки на мої проєкти?",
    "Хто з команди найбільш завантажений?",
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
    <div className="ai-thinking" role="status">
      <span className="ai-thinking-avatar" aria-hidden="true">
        <i className="bi bi-stars"></i>
      </span>
      <span className="visually-hidden">{aiName} аналізує дані</span>
      <span aria-hidden="true" key={step} className="ai-thinking-text">
        {thinkingSteps[step]}
        <span className="ai-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </span>
    </div>
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
  const { user } = useAuth();
  const { exchanges, busy, error, send, cancel } = useAiChat();
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  // Матеріали до наступного запитання: сервер уже витягнув із них текст
  const [files, setFiles] = useState<AiAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = `ai-message-${variant}`;
  const locked = busy || reading || !configured;

  async function ask(question: string) {
    setLocalError("");
    if (!question.trim()) {
      setLocalError("Напишіть запитання.");
      return;
    }
    if (await send(question.trim(), context, files)) {
      setMessage("");
      setFiles([]);
    }
  }

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!chosen.length) return;
    setLocalError("");
    if (files.length + chosen.length > maxFiles) {
      setLocalError(`Можна прикріпити до ${maxFiles} файлів.`);
      return;
    }
    if (chosen.some((file) => file.size > maxFileSize)) {
      setLocalError("Кожен файл має бути до 5 МБ.");
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
  // У панелі Enter надсилає, Shift+Enter — новий рядок (як у месенджерах)
  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (variant !== "panel" || event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!locked) void ask(message);
  }

  return (
    <div className={`ai-conversation ${variant}`}>
      <div className="ai-history" aria-live="polite">
        {exchanges.map((item, index) => (
          <article
            key={index}
            className={item.offTopic ? "ai-exchange off-topic" : "ai-exchange"}
          >
            <h2>Ваше запитання</h2>
            <p className="preserve-lines ai-question">{item.question}</p>
            {item.files && item.files.length > 0 && (
              <ul className="ai-files" aria-label="Прикріплені файли">
                {item.files.map((name) => (
                  <li key={name}>
                    <i className="bi bi-paperclip" aria-hidden="true"></i>
                    {name}
                  </li>
                ))}
              </ul>
            )}
            <h2>{item.offTopic ? "Поза темою системи" : `${aiName} відповідає`}</h2>
            <Suspense fallback={<p role="status">Форматуємо відповідь…</p>}>
              <MarkdownAnswer>{item.answer}</MarkdownAnswer>
            </Suspense>
            {item.toolsUsed.length > 0 && (
              <p className="form-note">
                Джерела даних:{" "}
                {[...new Set(item.toolsUsed)]
                  .map((name) => aiToolNames[name] || "Дані проєкту")
                  .join(", ")}
              </p>
            )}
          </article>
        ))}
        {busy && <Thinking />}
      </div>
      {!exchanges.length && !busy && user && configured && (
        <div className="ai-suggestions">
          <p className="form-note">Спробуйте запитати:</p>
          {suggestions[user.role].map((text) => (
            <button
              key={text}
              type="button"
              className="ai-chip"
              disabled={busy}
              onClick={() => void ask(text)}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <form className="work-form ai-form" onSubmit={submit}>
        <label htmlFor={inputId}>Запитання до Ади</label>
        <textarea
          id={inputId}
          rows={variant === "panel" ? 3 : 4}
          required
          maxLength={1800}
          placeholder="Які завдання варто виконати першими?"
          value={message}
          disabled={busy || !configured}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKey}
        />
        {files.length > 0 && (
          <ul className="ai-files" aria-label="Файли до запитання">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <i className="bi bi-file-earmark-text" aria-hidden="true"></i>
                {file.name}
                {file.truncated && <small>обрізано</small>}
                <button
                  type="button"
                  aria-label={`Прибрати файл ${file.name}`}
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
            Читаємо файл…
          </p>
        )}
        {(localError || error) && (
          <p className="notice error" role="alert">
            {localError || error}
          </p>
        )}
        <div className="page-actions">
          <button className="button primary" disabled={locked}>
            <i className="bi bi-send" aria-hidden="true"></i>
            {busy ? "Аналізуємо…" : "Надіслати запит"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={locked || files.length >= maxFiles}
            title="TXT, PDF або DOCX, до 5 МБ, не більше 3 файлів"
            onClick={() => fileInput.current?.click()}
          >
            <i className="bi bi-paperclip" aria-hidden="true"></i>
            Прикріпити файл
          </button>
          {busy && (
            <button type="button" className="button secondary" onClick={cancel}>
              Скасувати запит
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
