import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { aiName, useAiChat } from "../aiChat";
import { useApi } from "../useApi";
import { AiConversation } from "../components/AiConversation";
import { ResourceState } from "../components/ResourceState";

import { useLanguage } from "../i18n";
export function AiAssistantPage() {
  const { tr } = useLanguage();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project");
  // ?analyze=1 ставить вкладка «Аналіз AI» проєкту: інструменти MCP запускаються лише тепер, коли її відкрили
  const analyze = params.get("analyze") === "1";
  const status = useApi<{ configured: boolean; toolsReadOnly: boolean }>(
    "/agent/status",
  );
  const { exchanges, busy, clear, send } = useAiChat();
  const analysisStarted = useRef(false);
  const configured = Boolean(status.data?.configured);
  useEffect(() => {
    if (!analyze || !projectId || !configured || analysisStarted.current) return;
    analysisStarted.current = true;
    // Прибираємо прапорець, щоб оновлення сторінки чи «Назад» не запускали аналіз удруге
    setParams({ project: projectId }, { replace: true });
    void send(
      tr(
        "Проаналізуй стан цього проєкту: прогрес, ризики й дедлайни, завантаження команди. Дай короткі рекомендації.",
      ),
      tr("Проєкт з ID {0}.", projectId),
    );
  }, [analyze, projectId, configured, send, setParams, tr]);
  return (
    <>
      {projectId && (
        <Link className="breadcrumb" to={`/projects/${projectId}`}>
          {tr("← До проєкту")}
        </Link>
      )}
      <div className="page-heading heading-with-action">
        <div>
          <h1>{tr(aiName)}</h1>
          <p>
            {tr(
              "AI-помічниця Tasko.ai: дедлайни, завдання, етапи, заявки й завантаження команди.",
            )}
          </p>
        </div>
        {exchanges.length > 0 && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={clear}
          >
            <i className="bi bi-trash3" aria-hidden="true"></i>

            {tr("Нова розмова")}
          </button>
        )}
      </div>
      <ResourceState
        loading={status.loading}
        error={status.error}
        onRetry={status.refresh}
      />
      {status.data && (
        <section className="data-panel padded ai-panel">
          <div className="ai-intro">
            <span className="ai-intro-avatar" aria-hidden="true">
              <i className="bi bi-stars"></i>
            </span>
            <div>
              <strong>
                {tr("Привіт! Я")} {tr(aiName)}.
              </strong>
              <p>
                {tr(
                  "Бачу лише дані, доступні вам, і пам'ятаю цю розмову. Вона ж відкривається кнопкою «",
                )}
                {tr(aiName)}
                {tr("» на будь-якій сторінці.")}
              </p>
            </div>
          </div>
          {projectId && (
            <p>
              <Link to={`/projects/${projectId}`}>{tr("Вибраний проєкт")}</Link>{" "}
              · <Link to="/ai">{tr("Запитати про всі доступні проєкти")}</Link>
            </p>
          )}
          {!status.data.configured && (
            <p className="notice error" role="alert">
              {tr(
                "AI-провайдер ще не підключений. Зверніться до адміністратора.",
              )}
            </p>
          )}
          <AiConversation
            variant="page"
            context={projectId ? tr("Проєкт з ID {0}.", projectId) : undefined}
            configured={status.data.configured}
          />
        </section>
      )}
    </>
  );
}
