// Модерація нових проєктів: клієнт створює проєкт, адміністратор схвалює
// (проєкт з'являється на біржі) або відхиляє з причиною.
import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, moderationChangedEvent, request } from "../api";
import { formatDate } from "../format";
import { ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { useApi } from "../useApi";
import type { ModerationProject } from "../types";

import { useLanguage } from "../i18n";

// Найчастіші причини відхилення — щоб модератор не писав їх щоразу вручну
const rejectPresets = [
  "Опис не пояснює, що саме треба зробити.",
  "Бюджет не відповідає обсягу роботи.",
  "В описі є контакти чи посилання для роботи поза платформою.",
  "Проєкт порушує правила платформи.",
  "Дедлайн нереальний для такого обсягу.",
];

export function AdminModerationPage() {
  const { tr } = useLanguage();
  const queue = useApi<ModerationProject[]>("/admin/moderation/projects");
  const [notice, setNotice] = useState("");

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{tr("Модерація проєктів")}</h1>
          <p>
            {tr(
              "Нові проєкти потрапляють на біржу лише після схвалення адміністратором.",
            )}
          </p>
        </div>
        <button className="button secondary" onClick={queue.refresh}>
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
          {tr("Оновити")}
        </button>
      </div>
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      <ResourceState
        loading={queue.loading}
        error={queue.error}
        onRetry={queue.refresh}
      />
      {queue.data && !queue.data.length && (
        <section className="empty-state data-panel">
          <h3>{tr("Черга модерації порожня")}</h3>
          <p>{tr("Усі нові проєкти розглянуто.")}</p>
        </section>
      )}
      <section className="application-list">
        {queue.data?.map((project) => (
          <ModerationCard
            key={project.id}
            project={project}
            onDecided={(message) => {
              setNotice(message);
              queue.refresh();
            }}
          />
        ))}
      </section>
    </>
  );
}

function ModerationCard({
  project,
  onDecided,
}: {
  project: ModerationProject;
  onDecided: (message: string) => void;
}) {
  const { tr } = useLanguage();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setError("");
    try {
      await request(`/admin/moderation/projects/${project.id}`, {
        method: "POST",
        body:
          decision === "APPROVE"
            ? { decision }
            : { decision, reason: reason.trim() },
      });
      window.dispatchEvent(new Event(moderationChangedEvent));
      onDecided(
        decision === "APPROVE"
          ? tr("Проєкт «{0}» схвалено й опубліковано на біржі.", project.title)
          : tr(
              "Проєкт «{0}» відхилено. Клієнт отримав причину.",
              project.title,
            ),
      );
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  function submitReject(event: FormEvent) {
    event.preventDefault();
    void decide("REJECT");
  }

  const budget =
    project.budgetMin == null && project.budgetMax == null
      ? tr("Бюджет не вказано")
      : tr(
          "{0}–{1} грн",
          project.budgetMin ?? 0,
          project.budgetMax ?? tr("необмежено"),
        );

  return (
    <article className="application-card moderation-card">
      <div className="moderation-card-heading">
        <h2>{project.title}</h2>
        <Link className="button secondary" to={`/projects/${project.id}`}>
          <i className="bi bi-box-arrow-up-right" aria-hidden="true"></i>
          {tr("Відкрити")}
        </Link>
      </div>
      {project.client && (
        <p className="admin-user-cell">
          <UserAvatar
            name={project.client.name}
            avatarUrl={project.client.avatarUrl}
            size="small"
          />
          <span>
            <strong>{project.client.name}</strong>
            <small>{project.client.email}</small>
          </span>
        </p>
      )}
      <p>{project.description || tr("Без опису")}</p>
      <dl className="marketplace-facts">
        <div>
          <dt>{tr("Надіслано")}</dt>
          <dd>{formatDate(project.updatedAt)}</dd>
        </div>
        <div>
          <dt>{tr("Бюджет")}</dt>
          <dd>{budget}</dd>
        </div>
        <div>
          <dt>{tr("Дедлайн")}</dt>
          <dd>{formatDate(project.deadline)}</dd>
        </div>
        <div>
          <dt>{tr("Категорія")}</dt>
          <dd>{project.category?.name || tr("Не вказано")}</dd>
        </div>
      </dl>
      {!!project.skills?.length && (
        <p className="skill-list">
          {project.skills.map((skill) => (
            <span className="badge" key={skill.id}>
              {skill.name}
            </span>
          ))}
        </p>
      )}
      {project.previousRejection && (
        <p className="notice">
          {tr(
            "Повторна подача. Минулого разу відхилено: {0}",
            project.previousRejection,
          )}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {rejecting ? (
        <form className="moderation-reject" onSubmit={submitReject}>
          <label htmlFor={`reject-${project.id}`}>
            {tr("Причина відхилення (її побачить клієнт)")}
          </label>
          {/* Типові причини одним кліком; текст можна доповнити */}
          <div className="reject-presets">
            {rejectPresets.map((preset) => (
              <button
                type="button"
                key={preset}
                className="chip-button"
                onClick={() =>
                  setReason((current) =>
                    current.trim()
                      ? `${current.trim()} ${tr(preset)}`
                      : tr(preset),
                  )
                }
              >
                {tr(preset)}
              </button>
            ))}
          </div>
          <textarea
            id={`reject-${project.id}`}
            rows={3}
            minLength={5}
            maxLength={1000}
            required
            value={reason}
            placeholder={tr("Що саме виправити, щоб проєкт пройшов модерацію")}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="page-actions">
            <button className="button danger-outline" disabled={busy}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
              {tr("Відхилити проєкт")}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setRejecting(false);
                setError("");
              }}
            >
              {tr("Скасувати")}
            </button>
          </div>
        </form>
      ) : (
        <div className="page-actions">
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void decide("APPROVE")}
          >
            <i className="bi bi-check-lg" aria-hidden="true"></i>
            {tr("Схвалити й опублікувати")}
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
            {tr("Відхилити")}
          </button>
        </div>
      )}
    </article>
  );
}
