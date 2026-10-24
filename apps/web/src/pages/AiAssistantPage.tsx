import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { useApi } from "../useApi";
import { ResourceState } from "../components/ResourceState";

const MarkdownAnswer = lazy(() => import("../components/MarkdownAnswer"));

const toolNames: Record<string, string> = {
  list_projects: "Список проєктів",
  list_tasks: "Завдання",
  get_project_summary: "Підсумок проєкту",
  get_upcoming_deadlines: "Дедлайни",
  get_workload: "Завантаження команди",
};

export function AiAssistantPage() {
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const status = useApi<{ configured: boolean; toolsReadOnly: boolean }>(
    "/agent/status",
  );
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<
    { question: string; answer: string; toolsUsed: string[] }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !status.data?.configured) return;
    setError("");
    const question = message.trim();
    if (!question) {
      setError("Напишіть запитання.");
      return;
    }
    setBusy(true);
    const current = new AbortController();
    controller.current = current;
    try {
      const result = await request<{ answer: string; toolsUsed: string[] }>(
        "/agent/chat",
        {
          method: "POST",
          body: {
            message: projectId
              ? `Проєкт з ID ${projectId}. ${question}`
              : question,
          },
          signal: current.signal,
          timeoutMs: 130000,
        },
      );
      setHistory((previous) => [...previous, { question, ...result }]);
      setMessage("");
    } catch (error) {
      setError(
        current.signal.aborted ? "Запит скасовано." : errorMessage(error),
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / ПОМІЧНИК</span>
        <h1>AI-агент</h1>
        <p>
          Дедлайни, стан завдань, прогрес і завантаження команди на основі
          доступних вам даних.
        </p>
      </div>
      <ResourceState
        loading={status.loading}
        error={status.error}
        onRetry={status.refresh}
      />
      {status.data && (
        <section className="data-panel padded ai-panel">
          <p className="notice">
            Агент читає дані через MCP із вашими правами доступу. Кожне
            запитання обробляється окремо; історія нижче зберігається до виходу
            зі сторінки.
          </p>
          {projectId && (
            <p>
              <Link to={`/projects/${projectId}`}>Вибраний проєкт</Link> ·{" "}
              <Link to="/ai">Запитати про всі доступні проєкти</Link>
            </p>
          )}
          {!status.data.configured && (
            <p className="notice error" role="alert">
              AI-провайдер ще не підключений. Зверніться до адміністратора.
            </p>
          )}
          <div className="ai-history" aria-live="polite">
            {history.map((item, index) => (
              <article key={index} className="ai-exchange">
                <h2>Ваше запитання</h2>
                <p className="preserve-lines">{item.question}</p>
                <h2>Відповідь агента</h2>
                <Suspense fallback={<p role="status">Форматуємо відповідь…</p>}>
                  <MarkdownAnswer>{item.answer}</MarkdownAnswer>
                </Suspense>
                {item.toolsUsed.length > 0 && (
                  <p className="form-note">
                    Джерела даних:{" "}
                    {[...new Set(item.toolsUsed)]
                      .map((name) => toolNames[name] || "Дані проєкту")
                      .join(", ")}
                  </p>
                )}
              </article>
            ))}
          </div>
          <form className="work-form section-gap" onSubmit={send}>
            <label htmlFor="ai-message">Запитання до AI</label>
            <textarea
              id="ai-message"
              rows={4}
              required
              maxLength={1800}
              placeholder="Які завдання варто виконати першими?"
              value={message}
              disabled={busy || !status.data.configured}
              onChange={(event) => setMessage(event.target.value)}
            />
            {busy && (
              <p role="status" className="form-note">
                Агент аналізує дані. Це може тривати до двох хвилин…
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="page-actions">
              <button
                className="button primary"
                disabled={busy || !status.data.configured}
              >
                <i className="bi bi-send" aria-hidden="true"></i>
                {busy ? "Аналізуємо…" : "Надіслати запит"}
              </button>
              {busy && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => controller.current?.abort()}
                >
                  Скасувати запит
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </>
  );
}
