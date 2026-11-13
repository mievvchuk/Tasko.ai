import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { Pagination, ResourceState } from "../components/ResourceState";
import { formatDate, parsePage } from "../format";
import { useApi } from "../useApi";
import { applicationStatusNames } from "../types";
import type { MarketplaceProject, ProjectCategory, Skill } from "../types";

import { useLanguage } from "../i18n";

// Фільтри живуть в адресі сторінки, тож посиланням можна поділитися
const filterKeys = [
  "search",
  "categoryId",
  "skillId",
  "minBudget",
  "maxBudget",
  "favoritesOnly",
] as const;

export function MarketplacePage() {
  const { tr } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const query = new URLSearchParams({ page: String(page), limit: "12" });
  for (const key of filterKeys) {
    const value = params.get(key)?.trim();
    if (value) query.set(key, value);
  }
  const { data, error, loading, refresh } = useApi<MarketplaceProject[]>(
    `/marketplace/projects?${query}`,
  );
  const categories = useApi<ProjectCategory[]>("/project-categories");
  const skills = useApi<Skill[]>("/skills");
  const [actionError, setActionError] = useState("");
  const filtered = filterKeys.some((key) => params.get(key));

  if (user?.role === "CLIENT") return <Navigate to="/projects" replace />;

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }
  function changePage(value: number) {
    const next = new URLSearchParams(params);
    if (value === 1) next.delete("page");
    else next.set("page", String(value));
    setParams(next);
  }
  async function toggleFavorite(project: MarketplaceProject) {
    setActionError("");
    try {
      await request(`/projects/${project.id}/favorite`, {
        method: project.isFavorite ? "DELETE" : "POST",
      });
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  return (
    <>
      <div className="page-heading">
        <h1>{tr("Відкриті проєкти")}</h1>
        <p>
          {tr(
            "Оберіть проєкт, запропонуйте бюджет і строк виконання. Після вибору клієнтом проєкт з’явиться у вашому робочому просторі.",
          )}
        </p>
      </div>
      <section className="data-panel market-filters" aria-label={tr("Фільтри")}>
        <label className="market-search">
          <span>{tr("Пошук")}</span>
          <input
            type="search"
            value={params.get("search") || ""}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder={tr("Назва або опис")}
          />
        </label>
        <label>
          <span>{tr("Категорія")}</span>
          <select
            value={params.get("categoryId") || ""}
            onChange={(event) => setFilter("categoryId", event.target.value)}
          >
            <option value="">{tr("Усі категорії")}</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tr("Навичка")}</span>
          <select
            value={params.get("skillId") || ""}
            onChange={(event) => setFilter("skillId", event.target.value)}
          >
            <option value="">{tr("Усі навички")}</option>
            {skills.data?.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tr("Бюджет від, грн")}</span>
          <input
            type="number"
            min="0"
            max="10000000"
            inputMode="numeric"
            value={params.get("minBudget") || ""}
            onChange={(event) => setFilter("minBudget", event.target.value)}
          />
        </label>
        <label>
          <span>{tr("Бюджет до, грн")}</span>
          <input
            type="number"
            min="0"
            max="10000000"
            inputMode="numeric"
            value={params.get("maxBudget") || ""}
            onChange={(event) => setFilter("maxBudget", event.target.value)}
          />
        </label>
        <div className="market-filter-actions">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={params.get("favoritesOnly") === "true"}
              onChange={(event) =>
                setFilter("favoritesOnly", event.target.checked ? "true" : "")
              }
            />
            {tr("Лише обране")}
          </label>
          {filtered && (
            <button
              type="button"
              className="button ghost"
              onClick={() => setParams({})}
            >
              {tr("Скинути")}
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          )}
        </div>
      </section>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <section
          className="marketplace-grid"
          aria-label={tr("Відкриті проєкти")}
        >
          {data?.map((project) => (
            <article className="marketplace-card" key={project.id}>
              <div className="market-card-top">
                <span className="badge">
                  {project.category?.name || tr("Без категорії")}
                </span>
                <button
                  className={
                    project.isFavorite
                      ? "favorite-button active"
                      : "favorite-button"
                  }
                  aria-pressed={project.isFavorite}
                  aria-label={
                    project.isFavorite
                      ? tr("Видалити з обраного")
                      : tr("Додати в обране")
                  }
                  onClick={() => void toggleFavorite(project)}
                >
                  <i
                    className={`bi ${project.isFavorite ? "bi-star-fill" : "bi-star"}`}
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
              <h2>
                <Link
                  className="market-card-link"
                  to={`/marketplace/${project.id}`}
                >
                  {project.title}
                </Link>
              </h2>
              <p className="market-excerpt">
                {project.description || tr("Клієнт не додав опис.")}
              </p>
              <div className="market-meta">
                <span>
                  <i className="bi bi-wallet2" aria-hidden="true"></i>
                  {budgetText(project, tr)}
                </span>
                <span>
                  <i className="bi bi-calendar-event" aria-hidden="true"></i>
                  {formatDate(project.deadline)}
                </span>
                {project.status === "ACTIVE" && (
                  <span>
                    <i className="bi bi-people" aria-hidden="true"></i>
                    {tr("Добирають команду")}
                  </span>
                )}
              </div>
              {project.applicationStatus && (
                <span className="application-chip">
                  {tr("Заявка:")}{" "}
                  {tr(applicationStatusNames[project.applicationStatus])}
                </span>
              )}
            </article>
          ))}
          {!data?.length && (
            <div className="empty-state marketplace-empty">
              <h3>
                {filtered
                  ? tr("За цими фільтрами проєктів немає")
                  : tr("Відкритих проєктів поки немає")}
              </h3>
              <p>
                {tr("Нові пропозиції клієнтів з’являться на цій сторінці.")}
              </p>
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

export function budgetText(
  project: MarketplaceProject,
  tr: (text: string, ...args: (string | number)[]) => string,
) {
  if (project.budgetMin === null && project.budgetMax === null)
    return tr("Бюджет не вказано");
  return tr(
    "{0}–{1} грн",
    project.budgetMin ?? 0,
    project.budgetMax ?? tr("необмежено"),
  );
}
