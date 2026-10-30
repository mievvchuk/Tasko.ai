import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";
import { useApi } from "../useApi";
import type { ProjectMember } from "../types";
import { Pagination, ResourceState } from "./ResourceState";

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
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const directory = useApi<{ id: string; name: string; email: string }[]>(
    `/directory/freelancers?page=${page}&limit=20`,
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
      setMessage(tr("Фрилансера додано до команди."));
      onAdded();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="padded">
      <p className="form-note">
        {tr(
          "Основного виконавця обрано через заявку. За потреби додайте інших фрилансерів для окремих завдань: вони отримають доступ до даних цього проєкту.",
        )}
      </p>
      <ResourceState
        loading={directory.loading}
        error={directory.error}
        onRetry={directory.refresh}
      />
      {directory.data && (
        <>
          <form className="member-form" onSubmit={add}>
            <label htmlFor="new-project-member">
              {tr("Додатковий виконавець")}
            </label>
            <select
              id="new-project-member"
              required
              value={userId}
              disabled={busy}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">{tr("Оберіть фрилансера")}</option>
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} — {person.email}
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
              {tr("На цій сторінці немає інших активних фрилансерів.")}
            </p>
          )}
          <Pagination
            page={page}
            count={directory.data.length}
            onChange={(value) => {
              setUserId("");
              setPage(value);
            }}
          />
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
