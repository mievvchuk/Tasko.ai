import { useState } from "react";
import { Link } from "react-router";
import { errorMessage, request } from "../api";
import { formatMoney } from "../format";
import { useLanguage } from "../i18n";
import {
  milestonePaymentNames,
  milestoneStatusNames,
  type ProjectMilestone,
} from "../types";

// Етапи проєкту — оплата частинами за групи завдань. Статус етапу рахується із завдань:
// коли всі виконано, етап чекає, поки замовник його прийме. Клік по етапу фільтрує завдання нижче.
export function MilestonesPanel({
  projectId,
  milestones,
  selected,
  owner,
  onSelect,
  onChanged,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  selected: string;
  owner: boolean;
  onSelect: (milestoneId: string) => void;
  onChanged: () => void;
}) {
  const { tr } = useLanguage();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  if (!milestones.length && !owner) return null;

  async function accept(item: ProjectMilestone) {
    setBusyId(item.id);
    setError("");
    try {
      await request(`/milestones/${item.id}`, {
        method: "PATCH",
        body: { status: "COMPLETED" },
      });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId("");
    }
  }

  const total = milestones.reduce((sum, item) => sum + item.amount, 0);
  const accepted = milestones
    .filter((item) => item.status === "COMPLETED")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <section
      className="data-panel milestones-panel"
      aria-labelledby="milestones-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="milestones-heading">{tr("Етапи й оплата")}</h2>
          {milestones.length > 0 && (
            <p className="form-note">
              {tr(
                "Прийнято {0} з {1}",
                formatMoney(accepted),
                formatMoney(total),
              )}
            </p>
          )}
        </div>
        {owner && (
          <Link
            className="button secondary"
            to={`/projects/${projectId}/milestones`}
          >
            <i className="bi bi-sliders" aria-hidden="true"></i>
            {tr("Керувати етапами")}
          </Link>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {milestones.length ? (
        <ol className="milestone-cards">
          {milestones.map((item, index) => {
            const percent = item.taskCount
              ? Math.round((item.doneTaskCount / item.taskCount) * 100)
              : 0;
            const active = selected === item.id;
            return (
              <li
                key={item.id}
                className={`milestone-card${active ? " selected" : ""}`}
              >
                <button
                  type="button"
                  className="milestone-card-main"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? "" : item.id)}
                  title={
                    active
                      ? tr("Показати всі завдання")
                      : tr("Показати завдання етапу")
                  }
                >
                  <span className="milestone-card-head">
                    <span className="milestone-index">{index + 1}</span>
                    <strong>{item.title}</strong>
                    <span className="milestone-amount">
                      {formatMoney(item.amount)}
                    </span>
                  </span>
                  <progress
                    max={100}
                    value={percent}
                    aria-label={tr("Прогрес етапу {0}", item.title)}
                  />
                  <span className="milestone-card-meta">
                    <span>
                      {item.taskCount
                        ? tr(
                            "Виконано {0} з {1} завдань",
                            item.doneTaskCount,
                            item.taskCount,
                          )
                        : tr("Завдань ще немає")}
                    </span>
                    <span className={`project-status status-${item.status}`}>
                      {tr(milestoneStatusNames[item.status])}
                    </span>
                    {item.paymentStatus !== "UNPAID" && (
                      <span className="project-status">
                        {tr(milestonePaymentNames[item.paymentStatus])}
                      </span>
                    )}
                  </span>
                </button>
                {owner && item.status === "REVIEW" && (
                  <button
                    type="button"
                    className="button primary milestone-accept"
                    disabled={busyId === item.id}
                    onClick={() => void accept(item)}
                  >
                    <i className="bi bi-check2-circle" aria-hidden="true"></i>
                    {tr("Прийняти етап")}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="form-note">
          {tr(
            "Етапів ще немає. Розбийте роботу на етапи через AI-планування або додайте їх вручну — оплата йтиме частинами.",
          )}
        </p>
      )}
    </section>
  );
}
