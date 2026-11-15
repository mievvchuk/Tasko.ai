import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import {
  notificationKind,
  notificationTarget,
  notificationToastEvent,
} from "../notificationKinds";
import type { Notification } from "../types";

// Нове сповіщення (подію шле useNotificationCounts) коротко з'являється в правому верхньому куті
const lifetime = 7000;
const maxToasts = 3;

export function Toaster() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const [toasts, setToasts] = useState<Notification[]>([]);

  useEffect(() => {
    function show(event: Event) {
      const item = (event as CustomEvent<Notification>).detail;
      setToasts((list) =>
        list.some((toast) => toast.id === item.id)
          ? list
          : [item, ...list].slice(0, maxToasts),
      );
      window.setTimeout(
        () => setToasts((list) => list.filter((toast) => toast.id !== item.id)),
        lifetime,
      );
    }
    window.addEventListener(notificationToastEvent, show);
    return () => window.removeEventListener(notificationToastEvent, show);
  }, []);

  const dismiss = (id: string) =>
    setToasts((list) => list.filter((toast) => toast.id !== id));
  const here = pathname + search;
  // Повідомлення з відкритого зараз чату не дублюємо спливаючим вікном
  const shown = toasts.filter(
    (toast) =>
      notificationTarget(toast, user?.role === "ADMIN") !== here ||
      toast.type !== "NEW_MESSAGE",
  );

  return (
    <div className="toaster" role="status" aria-live="polite">
      {shown.map((toast) => {
        const [title, icon] = notificationKind(toast.type);
        const target = notificationTarget(toast, user?.role === "ADMIN");
        return (
          <div key={toast.id} className="toast">
            <i className={`bi ${icon}`} aria-hidden="true"></i>
            <div>
              <strong>{tr(title)}</strong>
              <p>{toast.message}</p>
              {target !== here && (
                <Link to={target} onClick={() => dismiss(toast.id)}>
                  {tr("Переглянути")}
                  <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </Link>
              )}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label={tr("Закрити")}
              onClick={() => dismiss(toast.id)}
            >
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
}
