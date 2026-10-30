import { useEffect, useState } from "react";
import { Link, useLocation, useMatch } from "react-router";
import { aiName, useAiChat } from "../aiChat";
import { useApi } from "../useApi";
import { AiConversation } from "./AiConversation";

// Плаваюча кнопка AI в куті екрана + бічна панель з розмовою.
// На сторінці /ai не показується — там та сама розмова на весь екран.
export function AiDrawer() {
  const [open, setOpen] = useState(false);
  // Статус провайдера запитуємо лише після першого відкриття панелі
  const [started, setStarted] = useState(false);
  const { pathname } = useLocation();
  const { exchanges, busy, clear } = useAiChat();
  const status = useApi<{ configured: boolean }>(
    started ? "/agent/status" : null,
  );
  // Якщо відкрито сторінку проєкту чи завдання — підказуємо агенту, про що мова
  const projectMatch = useMatch("/projects/:id/*");
  const taskMatch = useMatch("/tasks/:id/*");
  const projectId = projectMatch?.params.id;
  const taskId = taskMatch?.params.id;
  const uuid = /^[0-9a-f-]{36}$/i;
  const context =
    taskId && uuid.test(taskId)
      ? `Я зараз на сторінці завдання з ID ${taskId}.`
      : projectId && uuid.test(projectId)
        ? `Я зараз на сторінці проєкту з ID ${projectId}.`
        : undefined;

  // Після відкриття ставимо курсор у поле запитання
  useEffect(() => {
    if (open) document.getElementById("ai-message-panel")?.focus();
  }, [open, status.data]);

  if (pathname === "/ai") return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-fab"
          aria-label={`Відкрити помічницю ${aiName}`}
          aria-controls="ai-drawer"
          aria-expanded={false}
          onClick={() => {
            setOpen(true);
            setStarted(true);
          }}
        >
          <i className="bi bi-stars" aria-hidden="true"></i>
          <span className="ai-fab-label">{aiName}</span>
        </button>
      )}
      {open && (
        <>
          {/* Підкладка: на телефоні затемнює сторінку, клік закриває панель */}
          <div
            className="ai-drawer-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <aside
            id="ai-drawer"
            className="ai-drawer"
            role="dialog"
            aria-label={`AI-помічниця ${aiName}`}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            <header className="ai-drawer-head">
              <span className="ai-drawer-mark" aria-hidden="true">
                <i className="bi bi-stars"></i>
              </span>
              <div>
                <strong>{aiName}</strong>
                <small>
                  {context ? "Бачить поточну сторінку" : "Питання про Tasko.ai"}
                </small>
              </div>
              {exchanges.length > 0 && (
                <button
                  type="button"
                  className="ai-drawer-action"
                  aria-label="Почати нову розмову"
                  title="Почати нову розмову"
                  disabled={busy}
                  onClick={clear}
                >
                  <i className="bi bi-trash3" aria-hidden="true"></i>
                </button>
              )}
              <Link
                className="ai-drawer-action"
                to="/ai"
                aria-label="Відкрити на всю сторінку"
                title="Відкрити на всю сторінку"
                onClick={() => setOpen(false)}
              >
                <i className="bi bi-arrows-angle-expand" aria-hidden="true"></i>
              </Link>
              <button
                type="button"
                className="ai-drawer-action"
                aria-label="Закрити панель помічниці"
                onClick={() => setOpen(false)}
              >
                <i className="bi bi-x-lg" aria-hidden="true"></i>
              </button>
            </header>
            <div className="ai-drawer-body">
              {status.loading && <p role="status">Підключаємося до агента…</p>}
              {status.error && (
                <p className="notice error" role="alert">
                  {status.error}
                </p>
              )}
              {status.data && !status.data.configured && (
                <p className="notice error" role="alert">
                  AI-провайдер ще не підключений. Зверніться до адміністратора.
                </p>
              )}
              {status.data && (
                <AiConversation
                  variant="panel"
                  context={context}
                  configured={status.data.configured}
                />
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
