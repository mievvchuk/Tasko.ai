import { Link } from "react-router";
// Прості діаграми на CSS, без сторонніх бібліотек.
// Числа завжди видно текстом, тож смуги лише ілюструють їх (aria-hidden).

export type ChartTone = "primary" | "accent" | "success" | "danger" | "muted";

export interface ChartItem {
  label: string;
  value: number;
  tone?: ChartTone;
}

// Горизонтальні смуги: довжина — частка від найбільшого значення
export function BarChart({
  title,
  items,
}: {
  title: string;
  items: ChartItem[];
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <figure className="chart-card">
      <figcaption>
        {title}
        <span>{total}</span>
      </figcaption>
      <ul className="bar-chart">
        {items.map((item) => (
          <li key={item.label}>
            <span className="bar-label">{item.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill tone-${item.tone ?? "primary"}`}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </span>
            <strong className="bar-value">{item.value}</strong>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// Стовпчики по місяцях для кількох рядів даних (наприклад, користувачі й проєкти)
export function ColumnChart({
  title,
  labels,
  series,
}: {
  title: string;
  labels: string[];
  series: { name: string; tone: ChartTone; values: number[] }[];
}) {
  const max = Math.max(1, ...series.flatMap((row) => row.values));
  return (
    <figure className="chart-card">
      <figcaption>{title}</figcaption>
      <div className="chart-legend">
        {series.map((row) => (
          <span key={row.name}>
            <i className={`legend-dot tone-${row.tone}`} aria-hidden="true" />
            {row.name}
          </span>
        ))}
      </div>
      <ol className="column-chart">
        {labels.map((label, index) => (
          <li
            key={label}
            aria-label={`${label}: ${series
              .map((row) => `${row.name.toLowerCase()} ${row.values[index]}`)
              .join(", ")}`}
          >
            <span className="columns" aria-hidden="true">
              {series.map((row) => (
                <span
                  key={row.name}
                  className={`column tone-${row.tone}`}
                  style={{ height: `${(row.values[index] / max) * 100}%` }}
                  title={`${row.name}: ${row.values[index]}`}
                >
                  <em>{row.values[index] || ""}</em>
                </span>
              ))}
            </span>
            <span className="column-label" aria-hidden="true">
              {label}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

const toneColor: Record<ChartTone, string> = {
  primary: "var(--data-blue)",
  accent: "var(--data-amber)",
  success: "var(--data-green)",
  danger: "var(--data-red)",
  muted: "var(--data-gray)",
};

// Кільце частин (conic-gradient) з числом у центрі й легендою-посиланнями
export function DonutChart({
  title,
  items,
  center,
  centerNote,
}: {
  title: string;
  items: (ChartItem & { to?: string })[];
  center: string;
  centerNote: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let start = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const end = start + (item.value / total) * 100;
      const stop = `${toneColor[item.tone ?? "primary"]} ${start}% ${end}%`;
      start = end;
      return stop;
    });
  return (
    <figure className="chart-card donut-card">
      <figcaption>
        {title}
        <span>{total}</span>
      </figcaption>
      <div className="donut-body">
        <div
          className="donut"
          aria-hidden="true"
          style={{
            background: stops.length
              ? `conic-gradient(${stops.join(", ")})`
              : "var(--color-paper-3)",
          }}
        >
          <span>
            <strong>{center}</strong>
            <small>{centerNote}</small>
          </span>
        </div>
        <ul className="donut-legend">
          {items.map((item) => {
            const content = (
              <>
                <i
                  className={`legend-dot tone-${item.tone ?? "primary"}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </>
            );
            return (
              <li key={item.label}>
                {item.to ? <Link to={item.to}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}
