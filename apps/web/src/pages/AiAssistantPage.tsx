import { Link, useSearchParams } from "react-router";
import { aiName, useAiChat } from "../aiChat";
import { useApi } from "../useApi";
import { AiConversation } from "../components/AiConversation";
import { ResourceState } from "../components/ResourceState";

export function AiAssistantPage() {
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const status = useApi<{ configured: boolean; toolsReadOnly: boolean }>(
    "/agent/status",
  );
  const { exchanges, busy, clear } = useAiChat();
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>{aiName}</h1>
          <p>
            AI-помічниця Tasko.ai: дедлайни, завдання, етапи, заявки й
            завантаження команди.
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
            Нова розмова
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
              <strong>Привіт! Я {aiName}.</strong>
              <p>
                Бачу лише дані, доступні вам, і пам'ятаю цю розмову. Вона ж
                відкривається кнопкою «{aiName}» на будь-якій сторінці.
              </p>
            </div>
          </div>
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
          <AiConversation
            variant="page"
            context={projectId ? `Проєкт з ID ${projectId}.` : undefined}
            configured={status.data.configured}
          />
        </section>
      )}
    </>
  );
}
