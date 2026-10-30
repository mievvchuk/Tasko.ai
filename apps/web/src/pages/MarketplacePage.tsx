import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { Pagination, ResourceState } from "../components/ResourceState";
import { formatDate, parsePage } from "../format";
import { useApi } from "../useApi";
import { applicationStatusNames } from "../types";
import type { MarketplaceProject } from "../types";

export function MarketplacePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const search = params.get("search") || "";
  const favoritesOnly = params.get("favoritesOnly") === "true";
  const marketplaceParams = new URLSearchParams({
    page: String(page),
    limit: "12",
  });
  if (search.trim()) marketplaceParams.set("search", search.trim());
  if (favoritesOnly) marketplaceParams.set("favoritesOnly", "true");
  const { data, error, loading, refresh } = useApi<MarketplaceProject[]>(
    `/marketplace/projects?${marketplaceParams.toString()}`,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "CLIENT") return <Navigate to="/projects" replace />;

  function changePage(value: number) {
    setParams(value === 1 ? {} : { page: String(value) });
  }

  function openForm(projectId: string) {
    setSelectedId(projectId);
    setMessage("");
    setBudget("");
    setDays("");
    setFormError("");
  }

  async function submit(event: FormEvent, projectId: string) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      await request(`/projects/${projectId}/applications`, {
        method: "POST",
        body: {
          message,
          proposedBudget: Number(budget),
          proposedDays: Number(days),
        },
      });
      setSelectedId(null);
      refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }
  async function toggleFavorite(project: MarketplaceProject) {
    try {
      await request(`/projects/${project.id}/favorite`, {
        method: project.isFavorite ? "DELETE" : "POST",
      });
      refresh();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <>
      <div className="page-heading">
        <h1>Відкриті проєкти</h1>
        <p>
          Оберіть проєкт, запропонуйте бюджет і строк виконання. Після вибору
          клієнтом проєкт з’явиться у вашому робочому просторі.
        </p>
      </div>
      <section className="data-panel inline-form">
        <label>
          Пошук
          <input
            value={search}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.delete("page");
              event.target.value
                ? next.set("search", event.target.value)
                : next.delete("search");
              setParams(next);
            }}
            placeholder="Назва або опис"
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              event.target.checked
                ? next.set("favoritesOnly", "true")
                : next.delete("favoritesOnly");
              setParams(next);
            }}
          />{" "}
          Лише обране
        </label>
      </section>
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section className="marketplace-grid" aria-label="Відкриті проєкти">
          {data?.map((project) => (
            <article className="marketplace-card" key={project.id}>
              <div className="marketplace-card-heading">
                <div>
                  <span className="project-status status-PLANNING">
                    Пошук виконавця
                  </span>
                  <h2>{project.title}</h2>
                </div>
                <time>{formatDate(project.deadline)}</time>
              </div>
              <p>{project.description || "Клієнт не додав опис."}</p>
              <button
                className="favorite-button"
                aria-label={
                  project.isFavorite ? "Видалити з обраного" : "Додати в обране"
                }
                onClick={() => void toggleFavorite(project)}
              >
                {project.isFavorite ? "★ В обраному" : "☆ До обраного"}
              </button>
              <dl className="marketplace-facts">
                <div>
                  <dt>Клієнт</dt>
                  <dd>{project.client?.name || "Клієнт"}</dd>
                </div>
                <div>
                  <dt>Опубліковано</dt>
                  <dd>{formatDate(project.createdAt)}</dd>
                </div>
                <div>
                  <dt>Бюджет</dt>
                  <dd>
                    {project.budgetMin !== null || project.budgetMax !== null
                      ? `${project.budgetMin ?? 0}–${project.budgetMax ?? "необмежено"} грн`
                      : "Не вказано"}
                  </dd>
                </div>
                <div>
                  <dt>Категорія</dt>
                  <dd>{project.category?.name || "Без категорії"}</dd>
                </div>
              </dl>
              {!!project.skills.length && (
                <p className="skill-list">
                  {project.skills.map((skill) => (
                    <span className="badge" key={skill.id}>
                      {skill.name}
                    </span>
                  ))}
                </p>
              )}
              {project.applicationStatus ? (
                <p className="application-notice">
                  Статус заявки:{" "}
                  {applicationStatusNames[project.applicationStatus]}
                </p>
              ) : selectedId === project.id ? (
                <form
                  className="application-form"
                  onSubmit={(event) => void submit(event, project.id)}
                >
                  <label>
                    Супровідне повідомлення
                    <textarea
                      value={message}
                      minLength={10}
                      maxLength={2000}
                      required
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Коротко опишіть досвід і спосіб виконання"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Бюджет, грн
                      <input
                        type="number"
                        min="1"
                        max="10000000"
                        required
                        value={budget}
                        onChange={(event) => setBudget(event.target.value)}
                      />
                    </label>
                    <label>
                      Строк, днів
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={days}
                        onChange={(event) => setDays(event.target.value)}
                      />
                    </label>
                  </div>
                  {formError && <p className="form-error">{formError}</p>}
                  <div className="page-actions">
                    <button className="button primary" disabled={submitting}>
                      <i className="bi bi-send" aria-hidden="true"></i>
                      {submitting ? "Надсилаємо…" : "Надіслати заявку"}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setSelectedId(null)}
                    >
                      Скасувати
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="button primary"
                  onClick={() => openForm(project.id)}
                >
                  Залишити заявку
                </button>
              )}
            </article>
          ))}
          {!data?.length && (
            <div className="empty-state marketplace-empty">
              <h3>Відкритих проєктів поки немає</h3>
              <p>Нові пропозиції клієнтів з’являться на цій сторінці.</p>
            </div>
          )}
        </section>
      )}
      {!loading && !error && (
        <Pagination
          page={page}
          count={data?.length || 0}
          size={12}
          onChange={changePage}
        />
      )}
    </>
  );
}
