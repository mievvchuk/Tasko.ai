import { Link } from "react-router";
import { LanguageButton, useLanguage } from "../i18n";
import { ThemePicker } from "../components/ThemePicker";

const features = [
  {
    icon: "bi-kanban",
    title: "Проєкти й канбан-дошка",
    text: "Завдання, пріоритети й дедлайни. Перетягуйте картки між стовпцями й бачте прогрес кожного проєкту.",
  },
  {
    icon: "bi-shop",
    title: "Біржа й заявки",
    text: "Клієнт публікує проєкт, фрилансери пропонують бюджет і строк, а клієнт обирає найкращу заявку.",
  },
  {
    icon: "bi-stars",
    title: "Ада — AI-помічниця",
    text: "Підкаже, що робити першим, знайде ризики й дедлайни та відповість на питання про ваші проєкти.",
  },
  {
    icon: "bi-diagram-3",
    title: "AI-план проєкту",
    text: "З опису проєкту AI пропонує етапи, завдання й критерії приймання. Ви лише перевіряєте й зберігаєте.",
  },
  {
    icon: "bi-flag",
    title: "Етапи та результати",
    text: "Здача роботи з файлами, перевірка клієнтом, повернення на доопрацювання й відгуки після завершення.",
  },
  {
    icon: "bi-bar-chart",
    title: "Аналітика й завантаженість",
    text: "Хто з команди перевантажений, які завдання прострочені та як рухається робота по всій платформі.",
  },
];

const steps = [
  {
    title: "Опублікуйте проєкт",
    text: "Опишіть задачу, бюджет і дедлайн — проєкт з’явиться на біржі.",
  },
  {
    title: "Оберіть виконавця",
    text: "Порівняйте заявки, рейтинг і досвід фрилансерів або попросіть AI допомогти.",
  },
  {
    title: "Прийміть результат",
    text: "Стежте за прогресом, перевіряйте роботу й залиште відгук після завершення.",
  },
];

const roles = [
  {
    icon: "bi-briefcase",
    title: "Для клієнтів",
    items: [
      "Публікація проєктів і вибір виконавця",
      "Канбан, етапи й умовна оплата",
      "Перевірка результатів і відгуки",
    ],
  },
  {
    icon: "bi-laptop",
    title: "Для фрилансерів",
    items: [
      "Біржа відкритих проєктів і заявки",
      "Профіль із навичками й портфоліо",
      "Ада підкаже пріоритети на день",
    ],
  },
];

// Вітальна сторінка для гостей: що вміє Tasko.ai і куди перейти далі
export function WelcomePage() {
  const { t, tr } = useLanguage();
  return (
    <div className="welcome">
      <header className="public-header welcome-header">
        <Link className="brand" to="/welcome">
          <span className="brand-mark" aria-hidden="true">
            t
          </span>
          Tasko<span className="brand-ai">.ai</span>
        </Link>
        <nav aria-label={tr("Навігація вітальної сторінки")}>
          <a href="#features">{tr("Можливості")}</a>
          <a href="#how">{tr("Як це працює")}</a>
          <LanguageButton />
          <ThemePicker />
          <Link to="/login">{t("login")}</Link>
        </nav>
      </header>

      <main>
        <section className="welcome-hero">
          <div className="welcome-hero-text">
            <span className="welcome-badge">
              <i className="bi bi-stars" aria-hidden="true"></i>
              {tr("Фриланс-проєкти з AI-помічницею")}
            </span>
            <h1>{tr("Від ідеї до прийнятого результату — в одному місці")}</h1>
            <p>
              {tr(
                "Tasko.ai поєднує біржу проєктів, канбан-дошку, етапи й перевірку робіт. А Ада, AI-помічниця, допомагає не пропустити жодного дедлайну.",
              )}
            </p>
            <div className="welcome-actions">
              <Link className="button primary" to="/register">
                {tr("Почати безкоштовно")}
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
              <Link className="button secondary" to="/login">
                {tr("Увійти")}
              </Link>
            </div>
          </div>

          {/* Ілюстрація: спрощена канбан-дошка з підказкою Ади */}
          <div className="welcome-preview" aria-hidden="true">
            <div className="preview-board">
              {[
                ["До виконання", ["Макет головної", "Тексти сторінок"]],
                ["У процесі", ["Кошик і оплата"]],
                ["Завершено", ["Прототип", "Логотип"]],
              ].map(([column, cards]) => (
                <div className="preview-column" key={column as string}>
                  <span>{tr(column as string)}</span>
                  {(cards as string[]).map((card) => (
                    <div className="preview-card" key={card}>
                      {tr(card)}
                      <i></i>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="preview-ada">
              <span className="ai-avatar">
                <i className="bi bi-stars"></i>
              </span>
              <p>
                <b>{tr("Ада")}</b>
                {tr("«Кошик і оплата» здається через 2 дні. Почніть з нього.")}
              </p>
            </div>
          </div>
        </section>

        <section className="welcome-section" id="features">
          <h2>{tr("Усе для роботи над проєктом")}</h2>
          <p className="welcome-lead">
            {tr(
              "Від публікації задачі до відгуку — без таблиць і чатів збоку.",
            )}
          </p>
          <div className="welcome-features">
            {features.map((feature) => (
              <article key={feature.title}>
                <i className={`bi ${feature.icon}`} aria-hidden="true"></i>
                <h3>{tr(feature.title)}</h3>
                <p>{tr(feature.text)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="welcome-section" id="how">
          <h2>{tr("Як це працює")}</h2>
          <ol className="welcome-steps">
            {steps.map((step, index) => (
              <li key={step.title}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <h3>{tr(step.title)}</h3>
                <p>{tr(step.text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="welcome-section welcome-roles">
          {roles.map((role) => (
            <article key={role.title}>
              <i className={`bi ${role.icon}`} aria-hidden="true"></i>
              <h3>{tr(role.title)}</h3>
              <ul>
                {role.items.map((item) => (
                  <li key={item}>
                    <i className="bi bi-check2" aria-hidden="true"></i>
                    {tr(item)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="welcome-cta">
          <h2>{tr("Готові спробувати?")}</h2>
          <p>
            {tr("Створіть акаунт клієнта або фрилансера — це займе хвилину.")}
          </p>
          <Link className="button primary" to="/register">
            {tr("Створити акаунт")}
          </Link>
        </section>
      </main>

      <footer className="public-footer">Tasko.ai · {t("footer")}</footer>
    </div>
  );
}
