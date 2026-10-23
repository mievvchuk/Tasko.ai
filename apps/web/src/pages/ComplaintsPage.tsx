import { useState, type FormEvent } from "react";
import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { formatDate } from "../format";
import type { Complaint } from "../types";
import { useApi } from "../useApi";

const statusNames = {
  OPEN: "Очікує розгляду",
  RESOLVED: "Вирішено",
  REJECTED: "Відхилено",
};
export function ComplaintsPage() {
  const { data, error, loading, refresh } = useApi<Complaint[]>(
    "/complaints?limit=50",
  );
  const [targetUserId, setTargetUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
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
      refresh();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / ПІДТРИМКА</span>
        <h1>Скарги</h1>
        <p>
          Опишіть проблему для адміністратора. Вкажіть UUID користувача або
          проєкту.
        </p>
      </div>
      <form className="data-panel form-grid" onSubmit={(e) => void submit(e)}>
        <label>
          UUID користувача
          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Необов’язково"
          />
        </label>
        <label>
          UUID проєкту
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Необов’язково"
          />
        </label>
        <label>
          Причина
          <input
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="full-width">
          Опис
          <textarea
            required
            minLength={10}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {formError && <p className="form-error full-width">{formError}</p>}
        <button className="button primary">Надіслати скаргу</button>
      </form>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="application-list">
          {data?.map((item) => (
            <article className="application-card" key={item.id}>
              <div className="application-person">
                <h2>{item.reason}</h2>
                <span className={`project-status status-${item.status}`}>
                  {statusNames[item.status]}
                </span>
              </div>
              <p>{item.description}</p>
              <small>{formatDate(item.createdAt, true)}</small>
              {item.adminNote && (
                <p>
                  <strong>Відповідь адміністратора:</strong> {item.adminNote}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
