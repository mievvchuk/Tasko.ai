import { BrandWord } from "../components/BrandWord";
import { BrandMark } from "../components/BrandMark";
import { useState } from "react";
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
    text: "Клієнт публікує проєкт, фрілансери пропонують бюджет і строк, а клієнт обирає найкращу заявку.",
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
    text: "Порівняйте заявки, рейтинг і досвід фрілансерів або попросіть AI допомогти.",
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
    title: "Для фрілансерів",
    items: [
      "Біржа відкритих проєктів і заявки",
      "Профіль із навичками й портфоліо",
      "Ада підкаже пріоритети на день",
    ],
  },
];

// Перемикач у головному блоці: та сама сторінка для замовника й для фрілансера
const audiences = {
  CLIENT: {
    tab: "Замовляю",
    title: "Від ідеї до прийнятого результату — в одному місці",
    text: "Опублікуйте проєкт, оберіть фрілансера із заявок і стежте за роботою на канбан-дошці. Ада, AI-помічниця, нагадає про дедлайни й ризики.",
    action: "Опублікувати проєкт",
  },
  FREELANCER: {
    tab: "Працюю",
    title: "Знаходьте проєкти й здавайте роботу без хаосу",
    text: "Відкриті проєкти з бюджетом і строком, заявка в кілька полів і зрозумілі етапи. Ада підкаже, за що братися сьогодні.",
    action: "Знайти роботу",
  },
} as const;
type Audience = keyof typeof audiences;

const openProjects = [
  ["Інтернет-магазин кераміки", "18 000–25 000 грн", "React"],
  ["Лендинг для кав'ярні", "6 000–9 000 грн", "Figma"],
];

// Вітальна сторінка для гостей: що вміє Tasko.ai і куди перейти далі
export function WelcomePage() {
  const { t, tr } = useLanguage();
  const [audience, setAudience] = useState<Audience>("CLIENT");
  const current = audiences[audience];
  return (
    <div className="welcome">
      <header className="welcome-header">
        <div className="welcome-header-inner">
          <Link className="brand welcome-brand" to="/welcome">
            <BrandMark />
            <BrandWord />
          </Link>
          <nav
            className="welcome-nav"
            aria-label={tr("Навігація вітальної сторінки")}
          >
            <a href="#features">{tr("Можливості")}</a>
            <a href="#how">{tr("Як це працює")}</a>
            <a href="#roles">{tr("Для кого")}</a>
          </nav>
          <div className="welcome-header-actions">
            <LanguageButton />
            <ThemePicker />
            <Link className="welcome-login" to="/login">
              {t("login")}
            </Link>
            <Link className="button primary" to="/register">
              {t("register")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <a className="welcome-news" href="#features">
          <span className="welcome-news-tag">{tr("Нове")}</span>
          <span>
            {tr("Ада складає план проєкту з етапами й завданнями з опису")}
          </span>
          <span className="welcome-news-link">
            {tr("Детальніше")}
            <i className="bi bi-arrow-right" aria-hidden="true"></i>
          </span>
        </a>

        <section className="welcome-hero">
          <div className="welcome-hero-text">
            <div
              className="audience-switch"
              role="group"
              aria-label={tr("Хто ви")}
            >
              {(Object.keys(audiences) as Audience[]).map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={audience === key}
                  onClick={() => setAudience(key)}
                >
                  {tr(audiences[key].tab)}
                </button>
              ))}
            </div>
            <h1>{tr(current.title)}</h1>
            <p>{tr(current.text)}</p>
            <div className="welcome-actions">
              <Link
                className="button hero-primary"
                to={
                  audience === "FREELANCER"
                    ? "/register?role=FREELANCER"
                    : "/register"
                }
              >
                {tr(current.action)}
                <i className="bi bi-arrow-right" aria-hidden="true"></i>
              </Link>
              <Link className="button hero-secondary" to="/login">
                {tr("Увійти")}
              </Link>
            </div>
          </div>

          {/* Ілюстрація: замовнику — спрощена дошка з підказкою Ади, фрілансеру — біржа */}
          <div className="welcome-preview" aria-hidden="true">
            {audience === "CLIENT" ? (
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
            ) : (
              <div className="preview-market">
                {openProjects.map(([title, budget, skill]) => (
                  <div className="preview-offer" key={title}>
                    <b>{tr(title)}</b>
                    <span>
                      <i className="bi bi-wallet2"></i>
                      {tr(budget)}
                    </span>
                    <small>{skill}</small>
                    <em>{tr("Залишити заявку")}</em>
                  </div>
                ))}
              </div>
            )}
            <div className="preview-ada">
              <span className="ai-avatar">
                <i className="bi bi-stars"></i>
              </span>
              <p>
                <b>{tr("Ада")}</b>
                {audience === "CLIENT"
                  ? tr(
                      "«Кошик і оплата» здається через 2 дні. Почніть з нього.",
                    )
                  : tr(
                      "Інтернет-магазин збігається з вашими навичками на 90%.",
                    )}
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

        <section className="welcome-section welcome-roles" id="roles">
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
            {tr("Створіть акаунт клієнта або фрілансера — це займе хвилину.")}
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
