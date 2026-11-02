import { trNow, uiLocale } from "./i18n.en.ts";
export function formatDate(value: string | null, withTime = false) {
  if (!value) return trNow("Не визначено");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return trNow("Не визначено");
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat(uiLocale(), options).format(date);
}

// Зрозумілий підпис пристрою для списку сеансів: «Chrome на Windows»
export function describeDevice(userAgent: string | null) {
  if (!userAgent) return trNow("Невідомий браузер");
  const browsers: [RegExp, string][] = [
    [/Edg\//, "Edge"],
    [/OPR\/|Opera/, "Opera"],
    [/Firefox\//, "Firefox"],
    [/Chrome\//, "Chrome"],
    [/Safari\//, "Safari"],
  ];
  const systems: [RegExp, string][] = [
    [/Android/, "Android"],
    [/iPhone|iPad/, "iOS"],
    [/Windows/, "Windows"],
    [/Mac OS X|Macintosh/, "macOS"],
    [/Linux/, "Linux"],
  ];
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return trNow("{0} на {1}", browser, system);
  return browser || system || trNow("Невідомий браузер");
}

export function parsePage(value: string | null) {
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 10000) return 1;
  return page;
}

export function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Скільки календарних днів до дедлайну: 0 — сьогодні, від'ємне — прострочено
export function daysLeft(deadline: string, now = new Date()) {
  const day = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(new Date(deadline)) - day(now)) / 86_400_000);
}

export function deadlineLabel(deadline: string, now = new Date()) {
  const days = daysLeft(deadline, now);
  if (days < 0) return trNow("Прострочено на {0} дн.", -days);
  if (days === 0) return trNow("Сьогодні");
  if (days === 1) return trNow("Завтра");
  return trNow("Через {0} дн.", days);
}
