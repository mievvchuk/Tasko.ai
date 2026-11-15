import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";
import { useApi } from "../useApi";
import type { ProjectMember } from "../types";
import { ResourceState } from "./ResourceState";

import { useLanguage } from "../i18n";
export function AddProjectMember({
  projectId,
  members,
  onAdded,
}: {
  projectId: string;
  members: ProjectMember[];
  onAdded: () => void;
}) {
  const { tr } = useLanguage();
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const directory = useApi<{ id: string; name: string; email: string }[]>(
    // Один список у полі вибору замість сторінок під ним
    "/directory/freelancers?limit=50",
  );
  const available =
    directory.data?.filter(
      (person) => !members.some((member) => member.userId === person.id),
    ) || [];

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await request(`/projects/${projectId}/members`, {
        method: "POST",
        body: { userId },
      });
      setUserId("");
      setMessage(tr("Фрілансера додано до команди."));
      onAdded();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="add-member">
      <p className="form-note">
        {tr(
          "Поки триває найм, команду можна поповнити й напряму: фрілансер отримає доступ до даних цього проєкту.",
        )}
      </p>
      <ResourceState
        loading={directory.loading}
        error={directory.error}
        onRetry={directory.refresh}
      />
      {directory.data && (
        <>
          <label className="add-member-label" htmlFor="new-project-member">
            {tr("Додати фрілансера")}
          </label>
          <form className="add-member-form" onSubmit={add}>
            <select
              id="new-project-member"
              required
              value={userId}
              disabled={busy}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">{tr("Оберіть фрілансера")}</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.email})
                </option>
              ))}
            </select>
            <button className="button primary" disabled={busy || !userId}>
              <i className="bi bi-plus-lg" aria-hidden="true"></i>
              {busy ? tr("Додаємо…") : tr("Додати до команди")}
            </button>
          </form>
          {!available.length && (
            <p className="form-note">
              {tr("Інших активних фрілансерів немає.")}
            </p>
          )}
        </>
      )}
      {message && (
        <p className="notice success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
