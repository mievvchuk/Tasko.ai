import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { errorMessage, request } from "./api";

import { useLanguage } from "./i18n";
// Ім'я AI-помічника в інтерфейсі (і в системному промпті на сервері)
export const aiName = "Ада";

// Одна пара «запитання — відповідь» у розмові з AI-агентом
export interface AiExchange {
  question: string;
  answer: string;
  toolsUsed: string[];
  offTopic: boolean;
  // Назви файлів, прикріплених до цього запитання
  files?: string[];
}

// Текст прикріпленого файлу, який повернув сервер (/agent/attachments)
export interface AiAttachment {
  name: string;
  text: string;
  truncated: boolean;
}

interface AiChatState {
  exchanges: AiExchange[];
  busy: boolean;
  error: string;
  send: (
    question: string,
    context?: string,
    attachments?: AiAttachment[],
  ) => Promise<boolean>;
  cancel: () => void;
  clear: () => void;
}

// Скільки останніх пар надсилаємо як «пам'ять» (сервер приймає до 12 реплік)
const memoryLimit = 6;

export const aiToolNames: Record<string, string> = {
  list_projects: "Список проєктів",
  list_tasks: "Завдання",
  get_project_summary: "Підсумок проєкту",
  get_upcoming_deadlines: "Дедлайни",
  get_workload: "Завантаження команди",
  get_dashboard: "Загальна статистика",
  get_task_details: "Деталі завдання",
  list_milestones: "Етапи проєкту",
  list_project_messages: "Повідомлення проєкту",
  list_project_applications: "Заявки",
  list_notifications: "Сповіщення",
  search_open_projects: "Біржа проєктів",
  list_freelancers: "Фрилансери",
  get_freelancer_profile: "Профіль фрилансера",
};

const AiChatContext = createContext<AiChatState | null>(null);

// Розмова живе в Layout, тому спільна для сторінки /ai і бічної панелі
export function AiChatProvider({ children }: { children: ReactNode }) {
  const { tr } = useLanguage();
  const [exchanges, setExchanges] = useState<AiExchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function send(
    question: string,
    context?: string,
    attachments: AiAttachment[] = [],
  ) {
    if (busy) return false;
    setError("");
    // Відмови «не по темі» в пам'ять не беремо — вони лише заважають контексту
    const history = exchanges
      .filter((item) => !item.offTopic)
      .slice(-memoryLimit)
      .flatMap((item) => [
        { role: "user", content: item.question.slice(0, 4000) },
        { role: "assistant", content: item.answer.slice(0, 4000) },
      ]);
    setBusy(true);
    const current = new AbortController();
    controller.current = current;
    try {
      const result = await request<Omit<AiExchange, "question">>(
        "/agent/chat",
        {
          method: "POST",
          body: {
            message: context ? `${context} ${question}` : question,
            history,
            attachments: attachments.map(({ name, text }) => ({ name, text })),
          },
          signal: current.signal,
          timeoutMs: 130000,
        },
      );
      setExchanges((previous) => [
        ...previous,
        {
          question,
          ...result,
          offTopic: Boolean(result.offTopic),
          files: attachments.map((file) => file.name),
        },
      ]);
      return true;
    } catch (error) {
      setError(
        current.signal.aborted ? tr("Запит скасовано.") : errorMessage(error),
      );
      return false;
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }

  function clear() {
    controller.current?.abort();
    setExchanges([]);
    setError("");
  }

  return (
    <AiChatContext.Provider
      value={{
        exchanges,
        busy,
        error,
        send,
        cancel: () => controller.current?.abort(),
        clear,
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
}

export function useAiChat() {
  const value = useContext(AiChatContext);
  if (!value) throw new Error("useAiChat працює лише всередині AiChatProvider");
  return value;
}
