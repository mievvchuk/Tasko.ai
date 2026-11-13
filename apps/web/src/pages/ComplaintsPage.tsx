import { useState, type FormEvent } from "react";
import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import { complaintStatusNames as statusNames, roleNames } from "../types";
import type { Complaint, UserRole } from "../types";
import { UserAvatar } from "../components/UserAvatar";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
interface Targets {
  projects: { id: string; title: string }[];
  users: {
    id: string;
    name: string;
    role: UserRole;
    projects: string[];
    projectIds: string[];
  }[];
}

const searchFrom = 5;

export function ComplaintsPage() {
  const { tr } = useLanguage();
  const { data, error, loading, refresh } = useApi<Complaint[]>(
    "/complaints?limit=50",
  );
  const targets = useApi<Targets>("/complaints/targets");
  const [query, setQuery] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const selectedPerson = targets.data?.users.find(
    (person) => person.id === targetUserId,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    try {
      await request("/complaints", {
        method: "POST",
        body: {
          targetUserId: targetUserId || undefined,
          projectId: projectId || undefined,
          reason,
          description,
        },
      });
      setReason("");
      setDescription("");
      setTargetUserId("");
      setProjectId("");
      refresh();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>{tr("Скарги")}</h1>
        <p>
          {tr(
            "Оберіть людину або проєкт і опишіть проблему для адміністратора.",
          )}
        </p>
      </div>
      <form
        className="data-panel form-grid complaint-form"
        onSubmit={(e) => void submit(e)}
      >
        <fieldset className="full-width complaint-targets">
          <legend>{tr("На кого скарга")}</legend>
          <ResourceState
            loading={targets.loading}
            error={targets.error}
            onRetry={targets.refresh}
          />
          {targets.data && (
            <>
              {/* Кількох людей видно й так; пошук потрібен, лише коли список довгий */}
              {targets.data.users.length > searchFrom && (
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr("Пошук за ім'ям")}
                  aria-label={tr("Пошук за ім'ям")}
                />
              )}
              <div className="target-list" role="radiogroup">
                {targets.data.users
                  .filter((person) =>
                    person.name
                      .toLowerCase()
                      .includes(query.trim().toLowerCase()),
                  )
                  .map((person) => (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={targetUserId === person.id}
                      key={person.id}
                      className={
                        targetUserId === person.id
                          ? "target-card active"
                          : "target-card"
                      }
                      onClick={() => {
                        const picked = targetUserId !== person.id;
                        setTargetUserId(picked ? person.id : "");
                        // Підставляємо спільний проєкт, щоб не шукати його вручну
                        setProjectId(picked ? person.projectIds[0] || "" : "");
                      }}
                    >
                      <UserAvatar name={person.name} size="small" />
                      <span>
                        <strong>{person.name}</strong>
                        <small>
                          {tr(roleNames[person.role])} ·{" "}
                          {person.projects.join(", ")}
                        </small>
                      </span>
                      <i
                        className={`bi ${targetUserId === person.id ? "bi-check-circle-fill" : "bi-circle"}`}
                        aria-hidden="true"
                      ></i>
                    </button>
                  ))}
                {!targets.data.users.length && (
                  <p className="form-note">
                    {tr("Поки немає людей, з якими ви працюєте в проєктах.")}
                  </p>
                )}
              </div>
            </>
          )}
        </fieldset>
        <label>
          {tr("Проєкт")}
          <select
            value={projectId}
            disabled={!targets.data}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">{tr("Без проєкту")}</option>
            {targets.data?.projects
              .filter(
                (project) =>
                  !selectedPerson ||
                  selectedPerson.projectIds.includes(project.id),
              )
              .map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Причина")}
          <input
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="full-width">
          {tr("Опис")}
          <textarea
            required
            rows={3}
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {formError && <p className="form-error full-width">{formError}</p>}
        <button
          className="button primary"
          disabled={!targetUserId && !projectId}
        >
          <i className="bi bi-send" aria-hidden="true"></i>

          {tr("Надіслати скаргу")}
        </button>
      </form>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="application-list">
          {data?.map((item) => (
            <article className="application-card" key={item.id}>
              <div className="application-person">
                <h2>{item.reason}</h2>
                <span className={`project-status status-${item.status}`}>
                  {tr(statusNames[item.status])}
                </span>
              </div>
              <p>{item.description}</p>
              <small>{formatDate(item.createdAt, true)}</small>
              {item.adminNote && (
                <p>
                  <strong>{tr("Відповідь адміністратора:")}</strong>{" "}
                  {item.adminNote}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
