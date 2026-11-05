import { useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth";
import { BrandMark } from "../components/BrandMark";
import { BrandWord } from "../components/BrandWord";
import { useLanguage } from "../i18n";

// Позначка «щойно зареєструвався»: після входу GuestRoute веде сюди, а не на головну
export const justRegisteredKey = "tasko.justRegistered";

const steps = {
  CLIENT: [
    {
      icon: "bi-plus-square",
      title: "Опишіть перший проєкт",
      text: "Назва, бюджет, дедлайн і потрібні навички. Проєкт одразу побачать фрілансери.",
      to: "/projects/new",
      action: "Створити проєкт",
    },
    {
      icon: "bi-people",
      title: "Оберіть виконавця",
      text: "Порівняйте заявки за бюджетом, строком і рейтингом — або попросіть AI їх упорядкувати.",
      to: "/projects",
      action: "Мої проєкти",
    },
    {
      icon: "bi-stars",
      title: "Плануйте разом з Адою",
      text: "AI розіб'є проєкт на етапи й завдання та підкаже, де ризики з дедлайнами.",
      to: "/ai",
      action: "Відкрити Аду",
    },
  ],
  FREELANCER: [
    {
      icon: "bi-person-badge",
      title: "Заповніть профіль",
      text: "Фото, коротко про себе, навички й ставка — так клієнти швидше вам довірять.",
      to: "/profile",
      action: "До профілю",
    },
    {
      icon: "bi-shop",
      title: "Знайдіть проєкт",
      text: "На біржі — відкриті проєкти з бюджетом і дедлайном. Фільтруйте за навичками.",
      to: "/marketplace",
      action: "Відкрити біржу",
    },
    {
      icon: "bi-send",
      title: "Подайте заявку",
      text: "Запропонуйте бюджет і строк, додайте роботу з портфоліо. Після вибору — канбан і чат.",
      to: "/marketplace",
      action: "Шукати проєкти",
    },
  ],
};

export function GettingStartedPage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  useEffect(() => {
    try {
      sessionStorage.removeItem(justRegisteredKey);
    } catch {
      // без сховища сторінка просто не відкриється повторно автоматично
    }
  }, []);
  if (!user) return null;
  const role = user.role === "FREELANCER" ? "FREELANCER" : "CLIENT";
  const firstName = user.name.trim().split(/\s+/)[0];
  const [main] = steps[role];
  return (
    <main className="onboarding">
      <div className="onboarding-glow" aria-hidden="true"></div>
      <section className="onboarding-card">
        <div className="brand onboarding-brand">
          <BrandMark />
          <BrandWord />
        </div>
        <div className="onboarding-hello" aria-hidden="true">
          <i className="bi bi-stars"></i>
        </div>
        <h1>{tr("Вітаємо в Tasko.ai, {0}!", firstName)}</h1>
        <p className="onboarding-lead">
          {role === "CLIENT"
            ? tr(
                "Тут ви знайдете виконавця, розплануєте роботу й приймете результат — усе в одному місці. Ось із чого почати:",
              )
            : tr(
                "Тут ви знайдете замовлення, домовитеся про умови й здасте роботу — усе в одному місці. Ось із чого почати:",
              )}
        </p>
        <ol className="onboarding-steps">
          {steps[role].map((step, index) => (
            <li key={step.title} style={{ animationDelay: `${index * 90}ms` }}>
              <span className="onboarding-step-number">{index + 1}</span>
              <i className={`bi ${step.icon}`} aria-hidden="true"></i>
              <h2>{tr(step.title)}</h2>
              <p>{tr(step.text)}</p>
              <Link to={step.to}>
                {tr(step.action)}
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
            </li>
          ))}
        </ol>
        <div className="onboarding-actions">
          <Link className="button primary" to={main.to}>
            {tr("Почати")}
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </Link>
          <Link className="button secondary" to="/">
            {tr("Перейти до робочого простору")}
          </Link>
        </div>
      </section>
    </main>
  );
}
