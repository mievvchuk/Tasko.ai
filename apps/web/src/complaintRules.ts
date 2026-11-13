// Правила розгляду скарг: категорія порушення + історія порушника → рекомендована санкція.
// Адміністратор бачить рекомендацію, але рішення ухвалює сам (може пом'якшити чи посилити).

export const complaintCategoryNames = {
  NON_PAYMENT: "Не оплатив виконану роботу",
  FRAUD: "Шахрайство, обман",
  NOT_DELIVERED: "Не виконав роботу або зірвав строки",
  POOR_QUALITY: "Робота не відповідає умовам",
  ABUSE: "Образи, погрози, спам",
  OFF_PLATFORM: "Вимагає працювати поза платформою",
  OTHER: "Інше",
} as const;
export type ComplaintCategory = keyof typeof complaintCategoryNames;

export const complaintActionNames = {
  NONE: "Без санкції",
  WARNING: "Попередження",
  RESTRICT: "Тимчасове обмеження",
  BLOCK: "Блокування акаунта",
} as const;
export type ComplaintAction = keyof typeof complaintActionNames;

export interface TargetHistory {
  // Попередні підтверджені скарги на цю людину
  confirmed: number;
}

export interface Recommendation {
  action: ComplaintAction;
  days?: number;
  why: string;
}

// Сходинки санкцій для кожної категорії: індекс — кількість попередніх підтверджених скарг
const ladders: Record<ComplaintCategory, Recommendation[]> = {
  FRAUD: [
    {
      action: "BLOCK",
      why: "Підтверджене шахрайство — блокування з першого разу.",
    },
  ],
  NON_PAYMENT: [
    {
      action: "RESTRICT",
      days: 14,
      why: "Неоплата: обмеження, доки клієнт не розрахується з виконавцем.",
    },
    { action: "BLOCK", why: "Повторна неоплата — блокування." },
  ],
  NOT_DELIVERED: [
    { action: "WARNING", why: "Перший зрив строків — попередження." },
    {
      action: "RESTRICT",
      days: 7,
      why: "Повторний зрив — обмеження на тиждень.",
    },
    {
      action: "RESTRICT",
      days: 30,
      why: "Систематичні зриви — обмеження на місяць.",
    },
    { action: "BLOCK", why: "Четвертий підтверджений зрив — блокування." },
  ],
  POOR_QUALITY: [
    {
      action: "NONE",
      why: "Суперечка про якість: рішення й пояснення сторонам, без санкції.",
    },
    { action: "WARNING", why: "Повторні претензії до якості — попередження." },
    {
      action: "RESTRICT",
      days: 7,
      why: "Систематично низька якість — обмеження.",
    },
  ],
  ABUSE: [
    { action: "WARNING", why: "Перша образа чи спам — попередження." },
    { action: "RESTRICT", days: 7, why: "Повторно — обмеження на тиждень." },
    { action: "BLOCK", why: "Систематичні образи — блокування." },
  ],
  OFF_PLATFORM: [
    {
      action: "WARNING",
      why: "Перша спроба вивести угоду з платформи — попередження.",
    },
    { action: "RESTRICT", days: 14, why: "Повторно — обмеження на два тижні." },
    { action: "BLOCK", why: "Систематично — блокування." },
  ],
  OTHER: [
    {
      action: "NONE",
      why: "Оцініть ситуацію за описом; санкція — за потреби.",
    },
    {
      action: "WARNING",
      why: "Повторні скарги на ту саму людину — попередження.",
    },
  ],
};

export function recommendAction(
  category: ComplaintCategory,
  history: TargetHistory,
): Recommendation {
  const ladder = ladders[category] ?? ladders.OTHER;
  return ladder[Math.min(history.confirmed, ladder.length - 1)];
}
