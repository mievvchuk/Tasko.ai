import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { Project, ProjectMilestone } from "../types";
import { useApi } from "../useApi";

const workNames = {
  PLANNED: "Заплановано",
  IN_PROGRESS: "У роботі",
  REVIEW: "На перевірці",
  COMPLETED: "Завершено",
};
const paymentNames = {
  UNPAID: "Не зарезервовано",
  RESERVED: "Умовно зарезервовано",
  PAID: "Позначено оплаченим",
};

export function ProjectMilestonesPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const milestones = useApi<ProjectMilestone[]>(
    id ? `/projects/${id}/milestones` : null,
  );
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const owner = user?.role === "ADMIN" || project.data?.clientId === user?.id;
  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await request(`/projects/${id}/milestones`, {
        method: "POST",
        body: {
          title,
          amount: Number(amount),
          position: (milestones.data?.length || 0) + 1,
        },
      });
      setTitle("");
      setAmount("");
      setNotice("Етап додано.");
      milestones.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function update(item: ProjectMilestone, body: object) {
    setError("");
    try {
      await request(`/milestones/${item.id}`, { method: "PATCH", body });
      milestones.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <h1>Етапи та умовна оплата</h1>
        <p>Суми й статуси тут є обліковими та не виконують реальний платіж.</p>
      </div>
      {notice && <p className="notice success">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      <ResourceState
        loading={milestones.loading || project.loading}
        error={milestones.error || project.error}
        onRetry={() => {
          milestones.refresh();
          project.refresh();
        }}
      />
      {owner && (
        <form
          className="data-panel inline-form"
          onSubmit={(e) => void create(e)}
        >
          <label>
            Назва етапу
            <input
              required
              minLength={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Сума, грн
            <input
              required
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button className="button primary">
            <i className="bi bi-plus-lg" aria-hidden="true"></i>
            Додати етап
          </button>
        </form>
      )}
      <section className="application-list">
        {milestones.data?.map((item) => (
          <article className="application-card" key={item.id}>
            <h2>
              {item.position}. {item.title}
            </h2>
            <p>{item.description || "Без опису"}</p>
            <dl className="marketplace-facts">
              <div>
                <dt>Статус</dt>
                <dd>{workNames[item.status]}</dd>
              </div>
              <div>
                <dt>Умовна оплата</dt>
                <dd>{paymentNames[item.paymentStatus]}</dd>
              </div>
              <div>
                <dt>Сума</dt>
                <dd>{item.amount.toLocaleString("uk-UA")} грн</dd>
              </div>
              <div>
                <dt>Дедлайн</dt>
                <dd>{formatDate(item.deadline)}</dd>
              </div>
            </dl>
            <div className="page-actions">
              {item.status === "PLANNED" && (
                <button
                  className="button secondary"
                  onClick={() => void update(item, { status: "IN_PROGRESS" })}
                >
                  Почати
                </button>
              )}
              {item.status === "IN_PROGRESS" && !owner && (
                <button
                  className="button secondary"
                  onClick={() => void update(item, { status: "REVIEW" })}
                >
                  Передати на перевірку
                </button>
              )}
              {item.status === "REVIEW" && owner && (
                <>
                  <button
                    className="button primary"
                    onClick={() => void update(item, { status: "COMPLETED" })}
                  >
                    Прийняти
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => void update(item, { status: "IN_PROGRESS" })}
                  >
                    Повернути
                  </button>
                </>
              )}
              {owner && (
                <select
                  aria-label={`Оплата ${item.title}`}
                  value={item.paymentStatus}
                  onChange={(e) =>
                    void update(item, { paymentStatus: e.target.value })
                  }
                >
                  <option value="UNPAID">Не зарезервовано</option>
                  <option value="RESERVED">Умовно зарезервовано</option>
                  <option value="PAID">Позначити оплаченим</option>
                </select>
              )}
            </div>
          </article>
        ))}
        {!milestones.data?.length && !milestones.loading && (
          <div className="empty-state data-panel">
            <h3>Етапів ще немає</h3>
          </div>
        )}
      </section>
    </>
  );
}
