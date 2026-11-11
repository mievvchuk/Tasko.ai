import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { ResourceState } from "../components/ResourceState";
import { dateInputEnd, formatDate, toDateInput } from "../format";
import type { Project, ProjectMilestone } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
import { uiLocale } from "../i18n.en";
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

type MilestoneFields = {
  title: string;
  amount: number;
  deadline: string | null;
  description: string;
};

// Спільна форма створення й редагування етапу
function MilestoneForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ProjectMilestone;
  submitLabel: string;
  onSubmit: (fields: MilestoneFields) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { tr } = useLanguage();
  const [title, setTitle] = useState(initial?.title || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [deadline, setDeadline] = useState(
    toDateInput(initial?.deadline || null),
  );
  const [description, setDescription] = useState(initial?.description || "");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const done = await onSubmit({
      title: title.trim(),
      amount: Number(amount),
      deadline: deadline ? dateInputEnd(deadline).toISOString() : null,
      description: description.trim(),
    });
    setBusy(false);
    if (done && !initial) {
      setTitle("");
      setAmount("");
      setDeadline("");
      setDescription("");
    }
  }
  return (
    <form
      className="inline-form milestone-form"
      onSubmit={(e) => void submit(e)}
    >
      <label>
        {tr("Назва етапу")}
        <input
          required
          minLength={2}
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {tr("Сума, грн")}
        <input
          required
          type="number"
          min="0"
          max="10000000"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        {tr("Дедлайн")}
        <input
          type="date"
          value={deadline}
          // onInput ловить дату, вставлену в поле напряму: React тоді пропускає onChange
          onInput={(e) => setDeadline(e.currentTarget.value)}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </label>
      <label className="milestone-form-wide">
        {tr("Опис")}
        <textarea
          rows={3}
          maxLength={3000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="page-actions">
        <button className="button primary" disabled={busy}>
          <i
            className={`bi ${initial ? "bi-check-lg" : "bi-plus-lg"}`}
            aria-hidden="true"
          ></i>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button secondary" onClick={onCancel}>
            {tr("Скасувати")}
          </button>
        )}
      </div>
    </form>
  );
}

export function ProjectMilestonesPage() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const milestones = useApi<ProjectMilestone[]>(
    id ? `/projects/${id}/milestones` : null,
  );
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const owner = project.data?.clientId === user?.id;
  async function create(fields: MilestoneFields) {
    setError("");
    setNotice("");
    try {
      const position =
        Math.max(0, ...(milestones.data?.map((item) => item.position) || [])) +
        1;
      await request(`/projects/${id}/milestones`, {
        method: "POST",
        body: { ...fields, deadline: fields.deadline || undefined, position },
      });
      setNotice(tr("Етап додано."));
      milestones.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }
  async function update(item: ProjectMilestone, body: object) {
    setError("");
    setNotice("");
    try {
      await request(`/milestones/${item.id}`, { method: "PATCH", body });
      milestones.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Етапи та умовна оплата")}</h1>
        <p>
          {tr(
            "Суми й статуси тут є обліковими та не виконують реальний платіж.",
          )}
        </p>
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
        <section className="data-panel padded">
          <MilestoneForm submitLabel={tr("Додати етап")} onSubmit={create} />
        </section>
      )}
      <section className="application-list">
        {milestones.data?.map((item) => (
          <article className="application-card" key={item.id}>
            {editingId === item.id ? (
              <MilestoneForm
                initial={item}
                submitLabel={tr("Зберегти")}
                onCancel={() => setEditingId("")}
                onSubmit={async (fields) => {
                  const done = await update(item, fields);
                  if (done) {
                    setEditingId("");
                    setNotice(tr("Етап оновлено."));
                  }
                  return done;
                }}
              />
            ) : (
              <>
                <h2>
                  {item.position}. {item.title}
                </h2>
                <p>{item.description || tr("Без опису")}</p>
                <dl className="marketplace-facts">
                  <div>
                    <dt>{tr("Статус")}</dt>
                    <dd>{tr(workNames[item.status])}</dd>
                  </div>
                  <div>
                    <dt>{tr("Умовна оплата")}</dt>
                    <dd>{tr(paymentNames[item.paymentStatus])}</dd>
                  </div>
                  <div>
                    <dt>{tr("Сума")}</dt>
                    <dd>
                      {item.amount.toLocaleString(uiLocale())} {tr("грн")}
                    </dd>
                  </div>
                  <div>
                    <dt>{tr("Дедлайн")}</dt>
                    <dd>{formatDate(item.deadline)}</dd>
                  </div>
                </dl>
                <div className="page-actions">
                  {owner && item.status !== "COMPLETED" && (
                    <button
                      className="button secondary"
                      onClick={() => setEditingId(item.id)}
                    >
                      <i className="bi bi-pencil" aria-hidden="true"></i>
                      {tr("Редагувати")}
                    </button>
                  )}
                  {item.status === "PLANNED" && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        void update(item, { status: "IN_PROGRESS" })
                      }
                    >
                      {tr("Почати")}
                    </button>
                  )}
                  {item.status === "IN_PROGRESS" && !owner && (
                    <button
                      className="button secondary"
                      onClick={() => void update(item, { status: "REVIEW" })}
                    >
                      {tr("Передати на перевірку")}
                    </button>
                  )}
                  {item.status === "REVIEW" && owner && (
                    <>
                      <button
                        className="button primary"
                        onClick={() =>
                          void update(item, { status: "COMPLETED" })
                        }
                      >
                        {tr("Прийняти")}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          void update(item, { status: "IN_PROGRESS" })
                        }
                      >
                        {tr("Повернути")}
                      </button>
                    </>
                  )}
                  {owner && (
                    <select
                      aria-label={tr("Оплата {0}", item.title)}
                      value={item.paymentStatus}
                      onChange={(e) =>
                        void update(item, { paymentStatus: e.target.value })
                      }
                    >
                      <option value="UNPAID">{tr("Не зарезервовано")}</option>
                      <option value="RESERVED">
                        {tr("Умовно зарезервовано")}
                      </option>
                      <option value="PAID">{tr("Позначити оплаченим")}</option>
                    </select>
                  )}
                </div>
              </>
            )}
          </article>
        ))}
        {!milestones.data?.length && !milestones.loading && (
          <div className="empty-state data-panel">
            <h3>{tr("Етапів ще немає")}</h3>
          </div>
        )}
      </section>
    </>
  );
}
