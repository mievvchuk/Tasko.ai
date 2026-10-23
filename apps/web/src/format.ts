export function formatDate(value: string | null, withTime = false) {
  if (!value) return "Не визначено";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Не визначено";
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  };
  if (withTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("uk-UA", options).format(date);
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
