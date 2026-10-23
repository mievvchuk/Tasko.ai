import { useAuth } from "../auth";
import { roleNames } from "../types";
import { SecuritySettings } from "../components/SecuritySettings";
import { FreelancerProfileEditor } from "../components/FreelancerProfileEditor";

export function WorkspacePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / ПРОФІЛЬ</span>
        <h1>
          Вітаємо, {user.name}{" "}
          <span className="greeting-dot" aria-hidden="true">
            .
          </span>
        </h1>
        <p>Ви увійшли до свого робочого простору.</p>
      </div>
      <section className="welcome-panel">
        <div className="welcome-symbol" aria-hidden="true">
          ✓
        </div>
        <div>
          <span className="card-kicker">УСЕ ГОТОВО ДО РОБОТИ</span>
          <h2>Ваш обліковий запис підключено</h2>
          <p>
            Дані нижче отримано з вашого облікового запису. Роль визначає
            доступні вам дії в системі.
          </p>
        </div>
        <span className="badge">Вхід підтверджено</span>
      </section>
      <section className="account-panel" aria-labelledby="account-title">
        <div className="section-heading">
          <div>
            <h2 id="account-title">Обліковий запис</h2>
            <p>Ваша інформація в Tasko.ai</p>
          </div>
          <span className="avatar large" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <dl className="account-details">
          <div>
            <dt>Ім’я</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Електронна пошта</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Роль у системі</dt>
            <dd>{roleNames[user.role]}</dd>
          </div>
        </dl>
      </section>
      {user.role === "FREELANCER" && <FreelancerProfileEditor />}
      <SecuritySettings user={user} />
      <div className="session-note">
        <span aria-hidden="true">↗</span>
        <p>
          Після перезавантаження сторінки вхід зберігається в цій вкладці. На
          спільному комп’ютері завершуйте роботу кнопкою виходу.
        </p>
      </div>
    </>
  );
}
