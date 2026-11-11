import pdfMake from 'pdfmake';
import { fileURLToPath } from 'node:url';
import type { AdminService } from './admin.service.js';

type Report = Awaited<ReturnType<AdminService['report']>>;

// PDF-звіт у вигляді панелі адміністратора: плитки з числами, середні часи,
// графік за тиждень і смуги за статусами. Ті самі числа, що на сайті (/admin/report).
// Кольори — світла тема з apps/web/src/tokens.css.
const color = {
  ink: '#1d1614',
  muted: '#615955',
  rule: '#d9d3cf',
  surface: '#fdfbf8',
  accent: '#ac3227',
  blue: '#2171cc',
  amber: '#df911a',
  green: '#2a904b',
  red: '#d03833',
  gray: '#a69c95',
};
const soft: Record<string, string> = {
  [color.blue]: '#e0ebf8',
  [color.amber]: '#f9e9d1',
  [color.green]: '#e1efe6',
  [color.red]: '#f8e3e2',
  [color.gray]: '#efecea',
};
const width = 515; // A4 мінус поля 40 + 40

const fontDirectory = fileURLToPath(
  new URL('../../node_modules/pdfmake/build/fonts/Roboto/', import.meta.url),
);

function hours(value: number | null) {
  if (value === null) return '—';
  const number = (n: number) =>
    n.toLocaleString('uk-UA', { maximumFractionDigits: 1 });
  if (value < 1) return `${Math.round(value * 60)} хв`;
  if (value < 48) return `${number(value)} год`;
  return `${number(value / 24)} дн.`;
}

const card = (body: unknown) => ({
  table: { widths: ['*'], body: [[body]] },
  layout: {
    hLineColor: () => color.rule,
    vLineColor: () => color.rule,
    fillColor: () => color.surface,
    paddingLeft: () => 12,
    paddingRight: () => 12,
    paddingTop: () => 10,
    paddingBottom: () => 10,
  },
});

const heading = (text: string) => ({
  text,
  fontSize: 12,
  bold: true,
  color: color.ink,
  margin: [0, 16, 0, 8],
});

// Плитка показника: кольоровий кружок, підпис, велике число
function tile(label: string, value: number | string, tone: string) {
  return {
    columns: [
      {
        width: 26,
        canvas: [
          { type: 'ellipse', x: 11, y: 13, r1: 11, r2: 11, color: soft[tone] },
          { type: 'ellipse', x: 11, y: 13, r1: 4, r2: 4, color: tone },
        ],
      },
      {
        stack: [
          { text: label, fontSize: 8.5, color: color.muted },
          { text: String(value), fontSize: 20, bold: true, color: color.ink },
        ],
      },
    ],
  };
}

function tileGrid(items: [string, number | string, string][], columns: number) {
  const rows: unknown[][] = [];
  for (let i = 0; i < items.length; i += columns)
    rows.push(
      Array.from({ length: columns }, (_, j) =>
        items[i + j] ? tile(...items[i + j]) : { text: '' },
      ),
    );
  return {
    table: { widths: Array(columns).fill('*'), body: rows },
    layout: {
      hLineColor: () => color.rule,
      vLineColor: () => color.rule,
      fillColor: () => color.surface,
      paddingLeft: () => 10,
      paddingRight: () => 8,
      paddingTop: () => 10,
      paddingBottom: () => 10,
    },
  };
}

// Горизонтальні смуги: довжина — частка від найбільшого значення
function bars(title: string, items: [string, number, string][], blockWidth: number) {
  const max = Math.max(1, ...items.map(([, value]) => value));
  // запас на рамки й відступи клітинки, щоб сусідні картки не наїжджали
  const barWidth = blockWidth - 24 - 90 - 30 - 24;
  return card({
    stack: [
      { text: title, bold: true, fontSize: 10, margin: [0, 0, 0, 6] },
      ...items.map(([label, value, tone]) => ({
        columns: [
          { width: 90, text: label, fontSize: 8.5, color: color.muted },
          {
            width: barWidth,
            canvas: [
              { type: 'rect', x: 0, y: 2, w: barWidth, h: 8, r: 4, color: '#efecea' },
              ...(value
                ? [{ type: 'rect', x: 0, y: 2, w: Math.max(8, (value / max) * barWidth), h: 8, r: 4, color: tone }]
                : []),
            ],
          },
          { width: 30, text: String(value), fontSize: 9, bold: true, alignment: 'right' },
        ],
        margin: [0, 3, 0, 3],
      })),
    ],
  });
}

function lineChart(report: Report) {
  const days = report.week.days;
  const series: [string, number[], string][] = [
    ['Користувачі', days.map((d) => d.users), color.blue],
    ['Проєкти', days.map((d) => d.projects), color.green],
    ['Скарги', days.map((d) => d.complaints), color.red],
  ];
  const w = width - 24;
  const h = 140;
  const max = Math.max(4, ...series.flatMap(([, values]) => values));
  const top = Math.ceil(max / 4) * 4;
  // Точка — по центру колонки з підписом дати під графіком
  const x = (i: number) => (i + 0.5) * (w / days.length);
  const y = (v: number) => 6 + (1 - v / top) * (h - 12);
  const grid = [0, 1, 2, 3, 4].map((step) => ({
    type: 'line',
    x1: 0,
    x2: w,
    y1: y((top / 4) * step),
    y2: y((top / 4) * step),
    lineWidth: 0.5,
    lineColor: color.rule,
  }));
  const lines = series.flatMap(([, values, tone]) => [
    {
      type: 'polyline',
      points: values.map((v, i) => ({ x: x(i), y: y(v) })),
      lineWidth: 2,
      lineColor: tone,
    },
    ...values.map((v, i) => ({ type: 'ellipse', x: x(i), y: y(v), r1: 2.5, r2: 2.5, color: tone })),
  ]);
  return card({
    stack: [
      {
        columns: [
          { text: 'Активність за 7 днів', bold: true, fontSize: 10 },
          { text: `верхня лінія — ${top}`, fontSize: 8, color: color.muted, alignment: 'right' },
        ],
        margin: [0, 0, 0, 6],
      },
      { canvas: [...grid, ...lines] },
      {
        columns: days.map(({ day }) => ({
          text: `${day.slice(8, 10)}.${day.slice(5, 7)}`,
          fontSize: 7.5,
          color: color.muted,
          alignment: 'center',
        })),
        margin: [0, 4, 0, 6],
      },
      {
        columns: series.map(([name, values, tone]) => ({
          text: [
            { text: '■ ', color: tone },
            { text: `${name}: ${values.reduce((a, b) => a + b, 0)} за тиждень`, fontSize: 8.5 },
          ],
          alignment: 'center',
        })),
      },
    ],
  });
}

// Стовпчики «нові за 6 місяців» (користувачі й проєкти поруч)
function growthChart(report: Report, blockWidth: number) {
  const w = blockWidth - 24;
  const h = 90;
  const max = Math.max(1, ...report.growth.flatMap((g) => [g.users, g.projects]));
  const slot = w / report.growth.length;
  const bar = Math.min(12, slot / 3);
  const shapes = report.growth.flatMap((g, i) =>
    (
      [
        [g.users, color.blue, 0],
        [g.projects, color.amber, 1],
      ] as const
    ).map(([value, tone, k]) => {
      const bh = Math.max(value ? 2 : 0, (value / max) * h);
      return { type: 'rect', x: i * slot + slot / 2 - bar + k * bar, y: h - bh, w: bar - 1, h: bh, color: tone };
    }),
  );
  return card({
    stack: [
      { text: 'Нові за 6 місяців', bold: true, fontSize: 10, margin: [0, 0, 0, 6] },
      { canvas: [{ type: 'line', x1: 0, x2: w, y1: h, y2: h, lineWidth: 0.5, lineColor: color.rule }, ...shapes] },
      {
        columns: report.growth.map((g) => ({
          text: new Date(`${g.month}-01T00:00:00Z`).toLocaleDateString('uk-UA', { month: 'short', timeZone: 'UTC' }),
          fontSize: 7.5,
          color: color.muted,
          alignment: 'center',
        })),
        margin: [0, 4, 0, 4],
      },
      {
        text: [{ text: '■ ', color: color.blue }, 'Користувачі   ', { text: '■ ', color: color.amber }, 'Проєкти'],
        fontSize: 8.5,
        alignment: 'center',
      },
    ],
  });
}

export async function buildReportPdf(report: Report) {
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory));
  pdfMake.addFonts({
    Roboto: {
      normal: `${fontDirectory}Roboto-Regular.ttf`,
      bold: `${fontDirectory}Roboto-Medium.ttf`,
      italics: `${fontDirectory}Roboto-Italic.ttf`,
      bolditalics: `${fontDirectory}Roboto-MediumItalic.ttf`,
    },
  });
  const half = (width - 12) / 2;
  const pair = (a: unknown, b: unknown) => ({ columns: [{ width: half, stack: [a] }, { width: half, stack: [b] }], columnGap: 12, margin: [0, 0, 0, 12] });
  const t = report.tasksByStatus;
  const p = report.projectsByStatus;
  const c = report.complaintsByStatus;
  const a = report.applicationsByStatus;
  const r = report.usersByRole;

  return pdfMake
    .createPdf({
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 48],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: color.ink },
      footer: (page: number, pages: number) => ({
        text: `Tasko.ai · сформовано автоматично з даних платформи · сторінка ${page} з ${pages}`,
        fontSize: 8,
        color: color.muted,
        alignment: 'center',
        margin: [0, 16, 0, 0],
      }),
      content: [
        {
          columns: [
            { text: [{ text: 'Tasko' }, { text: '.ai', color: color.accent }], fontSize: 16, bold: true },
            { text: `Звіт платформи · ${new Date().toLocaleString('uk-UA')}`, fontSize: 9, color: color.muted, alignment: 'right', margin: [0, 5, 0, 0] },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, x2: width, y1: 6, y2: 6, lineWidth: 1, lineColor: color.rule }] },
        { text: 'Статистика платформи', fontSize: 20, bold: true, margin: [0, 14, 0, 2] },
        { text: 'Ті самі показники, що в панелі адміністратора: користувачі, проєкти, заявки, скарги й завдання.', color: color.muted, fontSize: 9.5 },

        heading('Основні показники'),
        tileGrid(
          [
            ['Користувачі', report.users, color.blue],
            ['Нові за 7 днів', report.week.users, color.green],
            ['Проєкти', report.projects, color.blue],
            ['Нові проєкти за 7 днів', report.week.projects, color.green],
            ['Шукають виконавця', p.PLANNING, color.amber],
            ['Активні проєкти', report.activeProjects, color.blue],
            ['Завершені проєкти', report.completedProjects, color.green],
            ['Заблоковані', report.blockedUsers, color.red],
          ],
          4,
        ),

        heading('Замовлення'),
        tileGrid(
          [
            ['У роботі', report.ordersByStatus.IN_PROGRESS, color.blue],
            ['Виконано', report.ordersByStatus.COMPLETED, color.green],
            ['Скасовано', report.ordersByStatus.CANCELLED, color.red],
            ['Сума виконаних', report.completedOrdersAmount, color.green],
          ],
          4,
        ),

        heading('Середній час'),
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                ['Розгляд скарги', hours(report.averageHours.complaintResolution)],
                ['До першої заявки', hours(report.averageHours.firstApplication)],
                ['До вибору виконавця', hours(report.averageHours.hire)],
              ].map(([label, value]) => ({
                stack: [
                  { text: label, fontSize: 8.5, color: color.muted, alignment: 'center' },
                  { text: value, fontSize: 18, bold: true, alignment: 'center' },
                ],
              })),
            ],
          },
          layout: {
            hLineColor: () => color.rule,
            vLineColor: () => color.rule,
            fillColor: () => color.surface,
            paddingTop: () => 10,
            paddingBottom: () => 10,
          },
        },

        heading('Тиждень'),
        lineChart(report),

        heading('Розподіл за статусами'),
        pair(
          bars('Завдання', [['До виконання', t.TODO, color.gray], ['У процесі', t.IN_PROGRESS, color.blue], ['На перевірці', t.REVIEW, color.amber], ['Завершено', t.DONE, color.green], ['Прострочені', report.overdueTasks, color.red]], half),
          bars('Проєкти', [['Пошук виконавця', p.PLANNING, color.gray], ['У процесі', p.ACTIVE, color.blue], ['Призупинено', p.PAUSED, color.amber], ['Завершено', p.COMPLETED, color.green], ['Скасовано', p.CANCELLED, color.red]], half),
        ),
        pair(
          bars('Скарги', [['Очікують розгляду', c.OPEN, color.amber], ['Вирішено', c.RESOLVED, color.green], ['Відхилено', c.REJECTED, color.red]], half),
          bars('Заявки', [['Очікують рішення', a.PENDING, color.amber], ['Прийнято', a.ACCEPTED, color.green], ['Відхилено', a.REJECTED, color.red]], half),
        ),
        pair(
          bars('Користувачі за ролями', [['Клієнти', r.CLIENT, color.amber], ['Фрілансери', r.FREELANCER, color.blue], ['Адміністратори', r.ADMIN, color.gray]], half),
          growthChart(report, half),
        ),
      ],
    } as Parameters<typeof pdfMake.createPdf>[0])
    .getBuffer();
}
