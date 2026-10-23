import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { LoadError } from "../components/LoadError";
import { toDateTimeInput } from "../format";
import { projectStatusNames } from "../types";
import type { Project, ProjectStatus, ProjectCategory, Skill } from "../types";
import { useApi } from "../useApi";

export function ProjectFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setProject(null);
    setError("");
    setLoading(Boolean(id));
    if (!id) return;
    const controller = new AbortController();
    let active = true;
    void request<Project>(`/projects/${id}`, { signal: controller.signal })
      .then((result) => {
        if (active) setProject(result);
      })
      .catch((error: unknown) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, attempt]);

  if (loading)
    return (
      <div className="page-loading" role="status">
        Завантажуємо проєкт…
      </div>
    );
  if (error)
    return (
      <LoadError message={error} onRetry={() => setAttempt(attempt + 1)} />
    );
  if (id && (!project || project.id !== id)) return null;
  const canEdit =
    project && (user?.role === "ADMIN" || project.clientId === user?.id);
  const closed =
    project?.status === "COMPLETED" || project?.status === "CANCELLED";
  if ((!id && user?.role !== "CLIENT") || (id && !canEdit) || closed) {
    return (
      <section className="account-panel">
        <h1>Редагування недоступне</h1>
        <p>
          {closed
            ? "Завершений або скасований проєкт не можна змінювати."
            : "Створювати проєкти може клієнт, а редагувати — власник або адміністратор."}
        </p>
        <Link to={id ? `/projects/${id}` : "/projects"}>
          Повернутися до проєктів
        </Link>
      </section>
    );
  }
  return <ProjectForm key={id || "new"} project={id ? project : null} />;
}

function ProjectForm({ project }: { project: Project | null }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [deadline, setDeadline] = useState(
    toDateTimeInput(project?.deadline || null),
  );
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status || "PLANNING",
  );
  const categories = useApi<ProjectCategory[]>("/project-categories");
  const skills = useApi<Skill[]>("/skills");
  const [budgetMin, setBudgetMin] = useState(
    project?.budgetMin?.toString() || "",
  );
  const [budgetMax, setBudgetMax] = useState(
    project?.budgetMax?.toString() || "",
  );
  const [categoryId, setCategoryId] = useState(project?.categoryId || "");
  const [skillIds, setSkillIds] = useState<string[]>(
    project?.skills?.map((skill) => skill.id) || [],
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const backUrl = project ? `/projects/${project.id}` : "/projects";
  const originalDeadline = toDateTimeInput(project?.deadline || null);
  const deadlineChanged = deadline !== originalDeadline;
  const keepingOverdueDeadline =
    project &&
    !deadlineChanged &&
    deadline &&
    new Date(deadline).getTime() <= Date.now();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (title.trim().length < 2) {
      setError("Назва має містити щонайменше 2 символи.");
      return;
    }
    if (deadline && Number.isNaN(new Date(deadline).getTime())) {
      setError("Перевірте дату дедлайну.");
      return;
    }
    if (
      deadline &&
      deadlineChanged &&
      new Date(deadline).getTime() <= Date.now()
    ) {
      setError("Дедлайн проєкту має бути в майбутньому.");
      return;
    }
    if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
      setError("Максимальний бюджет не може бути меншим за мінімальний.");
      return;
    }
    setSubmitting(true);
    try {
      const body: {
        title: string;
        description: string;
        status?: ProjectStatus;
        deadline?: string | null;
        budgetMin?: number;
        budgetMax?: number;
        categoryId?: string;
        skillIds?: string[];
      } = { title: title.trim(), description };
      if (budgetMin !== "") body.budgetMin = Number(budgetMin);
      if (budgetMax !== "") body.budgetMax = Number(budgetMax);
      if (categoryId) body.categoryId = categoryId;
      body.skillIds = skillIds;
      if (project) body.status = status;
      // Незмінений дедлайн не перезаписуємо, щоб зберегти точність часу в БД.
      if (deadlineChanged)
        body.deadline = deadline ? new Date(deadline).toISOString() : null;
      const result = await request<{ id: string }>(
        project ? `/projects/${project.id}` : "/projects",
        { method: project ? "PATCH" : "POST", body },
      );
      await navigate(`/projects/${project?.id || result.id}`, {
        replace: true,
      });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link className="breadcrumb" to={backUrl}>
        ← {project ? "До проєкту" : "Мої проєкти"}
      </Link>
      <div className="page-heading">
        <h1>{project ? "Редагувати проєкт" : "Створити проєкт"}</h1>
        <p>Назва обов’язкова. Дедлайн указується за місцевим часом.</p>
      </div>
      <section className="data-panel project-form-panel">
        <form onSubmit={submit} aria-busy={submitting}>
          <fieldset className="form-fields" disabled={submitting}>
            <label htmlFor="project-title">
              Назва проєкту
              <input
                id="project-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                minLength={2}
                maxLength={200}
              />
            </label>
            <div className="project-form-field">
              <label htmlFor="project-description">Опис</label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={10000}
              />
            </div>
            <label htmlFor="project-deadline">
              Дедлайн
              <input
                id="project-deadline"
                type="datetime-local"
                step="1"
                min={
                  keepingOverdueDeadline
                    ? undefined
                    : toDateTimeInput(new Date().toISOString())
                }
                value={deadline}
                onInvalid={(event) => {
                  event.preventDefault();
                  setError("Дедлайн проєкту має бути в майбутньому.");
                }}
                onInput={(event) => {
                  setDeadline(event.currentTarget.value);
                  setError("");
                }}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
            <p className="form-note">Новий дедлайн має бути в майбутньому.</p>
            <div className="form-row">
              <label>
                Бюджет від, грн
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </label>
              <label>
                Бюджет до, грн
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
              </label>
            </div>
            <label>
              Категорія
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Без категорії</option>
                {categories.data?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="skill-picker">
              <legend>Потрібні навички</legend>
              {skills.data?.map((skill) => (
                <label key={skill.id}>
                  <input
                    type="checkbox"
                    checked={skillIds.includes(skill.id)}
                    onChange={(e) =>
                      setSkillIds(
                        e.target.checked
                          ? [...skillIds, skill.id]
                          : skillIds.filter((id) => id !== skill.id),
                      )
                    }
                  />{" "}
                  {skill.name}
                </label>
              ))}
            </fieldset>
            {project && (
              <div className="project-form-field">
                <label htmlFor="edit-project-status">Статус</label>
                <select
                  id="edit-project-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ProjectStatus)
                  }
                >
                  {Object.entries(projectStatusNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!project && (
              <p className="form-note">
                Новий проєкт матиме статус «Пошук виконавця» і буде доступний
                фрилансерам.
              </p>
            )}
            {project && (status === "COMPLETED" || status === "CANCELLED") && (
              <p className="notice">
                Після закриття редагування буде недоступне. Для завершення всі
                завдання та замовлення мають бути закриті.
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="page-actions">
              <button className="button primary" type="submit">
                {submitting ? "Зберігаємо…" : "Зберегти проєкт"}
              </button>
              {!submitting && (
                <Link className="button secondary" to={backUrl}>
                  Скасувати
                </Link>
              )}
            </div>
          </fieldset>
        </form>
      </section>
    </>
  );
}
