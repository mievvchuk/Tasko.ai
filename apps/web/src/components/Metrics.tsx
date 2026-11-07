import { useState } from "react";
import type { ChartTone } from "./Charts";

// Плитки показників: іконка в кольоровому кружку, підпис, підказка «i» і велике число
export interface KpiItem {
  label: string;
  value: number | string;
  icon: string;
  tone: ChartTone;
  hint: string;
}

export function KpiGrid({
  items,
  label,
  compact = false,
}: {
  items: KpiItem[];
  label?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={compact ? "kpi-grid compact" : "kpi-grid"}
      aria-label={label}
    >
      {items.map((item) => (
        <article className="kpi-tile" key={item.label}>
          <span className={`kpi-icon tone-soft-${item.tone}`} aria-hidden="true">
            <i className={`bi ${item.icon}`}></i>
          </span>
          <span className="kpi-text">
            <span className="kpi-label">{item.label}</span>
            <strong>{item.value}</strong>
          </span>
          <InfoTip text={item.hint} />
        </article>
      ))}
    </section>
  );
}

// Підказка з'являється під курсором і з клавіатури (фокус); екранний диктор читає aria-label
export function InfoTip({ text }: { text: string }) {
  return (
    <button type="button" className="info-tip" aria-label={text} data-tip={text}>
      <i className="bi bi-info-circle" aria-hidden="true"></i>
    </button>
  );
}

// Рядок середніх значень (наприклад, середній час розгляду)
export function AverageRow({
  items,
}: {
  items: { label: string; value: string; hint: string }[];
}) {
  return (
    <section className="average-row">
      {items.map((item) => (
        <article key={item.label}>
          <span className="average-label">
            {item.label}
            <InfoTip text={item.hint} />
          </span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </section>
  );
}

// Лінійна діаграма на SVG: кілька рядів по днях, сітка й легенда
export function LineChart({
  title,
  labels,
  series,
}: {
  title: string;
  labels: string[];
  series: { name: string; tone: ChartTone; values: number[] }[];
}) {
  const width = 560;
  const height = 240;
  const pad = { top: 12, right: 16, bottom: 28, left: 32 };
  const max = Math.max(1, ...series.flatMap((row) => row.values));
  // Ціла верхня межа, що ділиться на 4 рівні сітки
  const top = Math.ceil(max / 4) * 4;
  const x = (index: number) =>
    pad.left +
    (labels.length > 1
      ? (index / (labels.length - 1)) * (width - pad.left - pad.right)
      : 0);
  const y = (value: number) =>
    pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const ticks = [0, 1, 2, 3, 4].map((step) => (top / 4) * step);
  // Точка під курсором або фокусом: ряд і день
  const [active, setActive] = useState<{ row: number; index: number } | null>(null);
  const description = labels
    .map(
      (label, index) =>
        `${label}: ${series
          .map((row) => `${row.name.toLowerCase()} ${row.values[index]}`)
          .join(", ")}`,
    )
    .join("; ");
  return (
    <figure className="chart-card line-chart">
      <figcaption>{title}</figcaption>
      <div className="line-plot">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}. ${description}`}
      >
        {ticks.map((tick) => (
          <g key={tick} className="line-grid">
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {labels.map((label, index) => (
          <text
            key={label}
            className="line-axis"
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
        {series.map((row, rowIndex) => (
          <g key={row.name} className={`line-series stroke-${row.tone}`}>
            <polyline
              points={row.values
                .map((value, index) => `${x(index)},${y(value)}`)
                .join(" ")}
            />
            {row.values.map((value, index) => {
              const on = active?.row === rowIndex && active.index === index;
              return (
                <g
                  key={index}
                  className={on ? "line-point active" : "line-point"}
                  tabIndex={0}
                  aria-label={`${labels[index]}, ${row.name}: ${value}`}
                  onMouseEnter={() => setActive({ row: rowIndex, index })}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive({ row: rowIndex, index })}
                  onBlur={() => setActive(null)}
                >
                  {/* Невидиме більше коло — щоб у точку легко влучити курсором */}
                  <circle className="line-hit" cx={x(index)} cy={y(value)} r={12} />
                  <circle cx={x(index)} cy={y(value)} r={on ? 5.5 : 3.5} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {active && (
        <div
          className="line-tooltip"
          role="status"
          style={{
            left: `${(x(active.index) / width) * 100}%`,
            top: `${(y(series[active.row].values[active.index]) / height) * 100}%`,
          }}
        >
          <strong>{labels[active.index]}</strong>
          {series.map((row, rowIndex) => (
            <span
              key={row.name}
              className={rowIndex === active.row ? "current" : undefined}
            >
              <i className={`legend-dot tone-${row.tone}`} aria-hidden="true" />
              {row.name}: <b>{row.values[active.index]}</b>
            </span>
          ))}
        </div>
      )}
      </div>
      <div className="chart-legend">
        {series.map((row) => (
          <span key={row.name}>
            <i className={`legend-dot tone-${row.tone}`} aria-hidden="true" />
            {row.name}
          </span>
        ))}
      </div>
    </figure>
  );
}

// Таблиця-розбивка: назва, кількість, частка від суми
export function BreakdownTable({
  title,
  column,
  rows,
  totalLabel,
}: {
  title: string;
  column: [string, string, string];
  rows: { label: string; value: number }[];
  totalLabel: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const share = (value: number) =>
    total ? `${Math.round((value / total) * 100)}%` : "0%";
  return (
    <figure className="chart-card breakdown-table">
      <figcaption>{title}</figcaption>
      <table>
        <thead>
          <tr>
            {column.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.value}</td>
              <td>{share(row.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{totalLabel}</td>
            <td>{total}</td>
            <td>{total ? "100%" : "0%"}</td>
          </tr>
        </tfoot>
      </table>
    </figure>
  );
}
