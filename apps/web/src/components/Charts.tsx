// Прості діаграми на CSS, без сторонніх бібліотек.
// Числа завжди видно текстом, тож смуги лише ілюструють їх (aria-hidden).

export type ChartTone = "primary" | "accent" | "success" | "danger" | "muted";

export interface ChartItem {
  label: string;
  value: number;
  tone?: ChartTone;
}

// Горизонтальні смуги: довжина — частка від найбільшого значення
export function BarChart({ title, items }: { title: string; items: ChartItem[] }) {
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
