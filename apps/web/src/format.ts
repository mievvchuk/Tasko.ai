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

// Значення для <input type="date"> у місцевому часі: YYYY-MM-DD
export function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Дедлайн без години означає кінець обраного дня за місцевим часом
export function dateInputEnd(value: string) {
  return new Date(`${value}T23:59:59`);
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

// Складність пароля 0–4: 0 — порожній, 1 легкий, 2 середній, 3 складний, 4 дуже складний.
// Бали за довжину (8+, 12+), великі й малі літери, цифри та інші символи; коротший за 8 — завжди легкий.
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  if (password.length < 8) return 1;
  const points = [
    true,
    password.length >= 12,
    /\p{Ll}/u.test(password) && /\p{Lu}/u.test(password),
    /\d/.test(password),
    /[^\p{L}\d]/u.test(password),
  ].filter(Boolean).length;
  return points <= 2 ? 1 : points === 3 ? 2 : points === 4 ? 3 : 4;
}
