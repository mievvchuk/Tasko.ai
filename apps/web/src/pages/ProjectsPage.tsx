import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../auth";
import { errorMessage, request } from "../api";
import { parsePage } from "../format";
import { LoadError } from "../components/LoadError";
import { ProjectsTable } from "../components/ProjectsTable";
import { projectStatusNames } from "../types";
import type { Project } from "../types";

const pageSize = 10;

export function ProjectsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const rawStatus = params.get("status") || "";
  const status = Object.hasOwn(projectStatusNames, rawStatus) ? rawStatus : "";
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (status) query.set("status", status);
        const result = await request<Project[]>(
          "/projects?" + query.toString(),
          { signal: controller.signal },
        );
        if (active) setProjects(result);
      } catch (error) {
        if (active) setError(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, status, attempt]);

  function changePage(nextPage: number) {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (nextPage > 1) query.set("page", String(nextPage));
    setParams(query);
  }

  function changeStatus(nextStatus: string) {
    const query = new URLSearchParams();
    if (nextStatus) query.set("status", nextStatus);
    setParams(query);
  }

  const refresh = () => setAttempt((value) => value + 1);
  return (
    <>
      <div className="page-heading heading-with-action">
        <div>
          <h1>
            {user?.role === "ADMIN"
              ? "Проєкти"
              : user?.role === "FREELANCER"
                ? "Робочі проєкти"
                : "Мої проєкти"}
          </h1>
          <p>Доступні вам проєкти, їхній стан і прогрес виконання.</p>
        </div>
        <div className="page-actions">
          {user?.role === "CLIENT" && (
            <Link className="button primary" to="/projects/new">
              <i className="bi bi-plus-lg" aria-hidden="true"></i>
              Створити проєкт
            </Link>
          )}
          <button
            className="button secondary"
            onClick={refresh}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            Оновити дані
          </button>
        </div>
      </div>
      <section
        className="data-panel projects-panel"
        aria-labelledby="projects-title"
      >
        <div className="panel-heading project-toolbar">
          <div>
            <h2 id="projects-title">Список проєктів</h2>
            <p>Від нових до раніше створених</p>
          </div>
          <div className="filter-field">
            <label htmlFor="project-status">Статус проєкту</label>
            <select
              id="project-status"
              value={status}
              onChange={(event) => changeStatus(event.target.value)}
            >
              <option value="">Усі статуси</option>
              {Object.entries(projectStatusNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading && (
          <div className="page-loading" role="status">
            <span className="loader" />
            Завантажуємо проєкти…
          </div>
        )}
        {!loading && error && <LoadError message={error} onRetry={refresh} />}
        {!loading && !error && (
          <>
            {projects.length ? (
              <ProjectsTable projects={projects} />
            ) : (
              <div className="empty-state">
                <i className="bi bi-inbox empty-symbol" aria-hidden="true"></i>
                <h3>Проєктів не знайдено</h3>
                <p>
                  {user?.role === "FREELANCER"
                    ? "Тут відображатимуться проєкти, до яких вас додасть клієнт."
                    : "На цій сторінці немає доступних проєктів із вибраним статусом."}
                </p>
                {status && (
                  <button
                    className="button secondary"
                    onClick={() => changeStatus("")}
                  >
                    Скинути фільтр
                  </button>
                )}
              </div>
            )}
            <nav className="pagination" aria-label="Сторінки проєктів">
              <span>
                Сторінка {page} · Показано: {projects.length}
              </span>
              <div>
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => changePage(page - 1)}
                >
                  ← Попередня
                </button>
                <button
                  className="button secondary"
                  disabled={projects.length < pageSize || page === 10000}
                  onClick={() => changePage(page + 1)}
                >
                  Наступна →
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
    </>
  );
}
