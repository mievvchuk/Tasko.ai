import { useEffect, useRef } from "react";
import { dataChangedEvent } from "./api";

// Живе оновлення: сервер повідомляє, що дані на платформі змінились (потік /notifications/stream,
// подія «data»), і сторінка тихо перечитує свої дані — без перезавантаження й без мерехтіння.
// Кілька подій поспіль зливаються в одне перечитування; у прихованій вкладці запит
// відкладається, доки користувач до неї не повернеться.
export function useLiveRefresh(onChange: () => void, enabled = true) {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let missed = false;
    const fire = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => latest.current(), 400);
    };
    const onEvent = () => {
      if (document.hidden) missed = true;
      else fire();
    };
    const onVisible = () => {
      if (!document.hidden && missed) {
        missed = false;
        fire();
      }
    };
    window.addEventListener(dataChangedEvent, onEvent);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(dataChangedEvent, onEvent);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
