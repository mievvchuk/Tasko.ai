import { useEffect, useRef } from "react";
import { dataChangedEvent, notificationsChangedEvent, subscribe } from "./api";
import type { Notification } from "./types";
import { useApi } from "./useApi";

// Лічильники непрочитаних сповіщень і повідомлень для бічного меню.
// Нове сповіщення приходить через потік подій, тож числа оновлюються без перезавантаження сторінки.
// Цей хук тримає єдине SSE-з'єднання вкладки (його викликає бічне меню).
export function useNotificationCounts(userId: string | undefined) {
  const notifications = useApi<{
    items: Notification[];
    unreadCount: number;
    unreadMessages: number;
  }>(userId ? "/notifications?limit=1" : null);
  const { refresh } = notifications;
  useEffect(() => {
    window.addEventListener(notificationsChangedEvent, refresh);
    return () => window.removeEventListener(notificationsChangedEvent, refresh);
  }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void subscribe(
      "/notifications/stream",
      (type) => {
        if (type === "changed")
          window.dispatchEvent(new Event(notificationsChangedEvent));
        // Той самий потік несе й «дані змінились» для живого оновлення сторінок
        if (type === "data") window.dispatchEvent(new Event(dataChangedEvent));
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [userId]);
  // Під час оновлення показуємо попередні числа, щоб значок не блимав
  const counts = useRef({ unreadCount: 0, unreadMessages: 0 });
  if (notifications.data) counts.current = notifications.data;
  return counts.current;
}
