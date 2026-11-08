import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { LoadError } from "../components/LoadError";
import { dateInputEnd, toDateInput } from "../format";
import { inModeration, projectStatusNames } from "../types";
import type { Project, ProjectStatus, ProjectCategory, Skill } from "../types";
import { useApi } from "../useApi";

import { useLanguage } from "../i18n";
export function ProjectFormPage() {
  const { tr } = useLanguage();
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
        {tr("Завантажуємо проєкт…")}
      </div>
    );
  if (error)
    return (
      <LoadError message={error} onRetry={() => setAttempt(attempt + 1)} />
    );
  if (id && (!project || project.id !== id)) return null;
  const canEdit = project && project.clientId === user?.id;
  const closed =
    project?.status === "COMPLETED" || project?.status === "CANCELLED";
  if ((!id && user?.role !== "CLIENT") || (id && !canEdit) || closed) {
    return (
      <section className="account-panel">
        <h1>{tr("Редагування недоступне")}</h1>
        <p>
          {closed
            ? tr("Завершений або скасований проєкт не можна змінювати.")
            : tr(
                "Створювати проєкти може клієнт, а редагувати — власник або адміністратор.",
              )}
        </p>
        <Link to={id ? `/projects/${id}` : "/projects"}>
          {tr("Повернутися до проєктів")}
        </Link>
      </section>
    );
  }
  return <ProjectForm key={id || "new"} project={id ? project : null} />;
}

function ProjectForm({ project }: { project: Project | null }) {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [deadline, setDeadline] = useState(
    toDateInput(project?.deadline || null),
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
  const [categoryName, setCategoryName] = useState(
    project?.category?.name || "",
  );
  const [skillNames, setSkillNames] = useState<string[]>(
    project?.skills?.map((skill) => skill.name) || [],
  );
  const [skillDraft, setSkillDraft] = useState("");

  function addSkill() {
    const name = skillDraft.trim().toLowerCase();
    if (name && !skillNames.includes(name) && skillNames.length < 30)
      setSkillNames([...skillNames, name]);
    setSkillDraft("");
  }
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const backUrl = project ? `/projects/${project.id}` : "/projects";
  const originalDeadline = toDateInput(project?.deadline || null);
  const deadlineChanged = deadline !== originalDeadline;
  const keepingOverdueDeadline =
    project &&
    !deadlineChanged &&
    deadline &&
    dateInputEnd(deadline).getTime() <= Date.now();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (title.trim().length < 2) {
      setError(tr("Назва має містити щонайменше 2 символи."));
      return;
    }
    if (deadline && Number.isNaN(dateInputEnd(deadline).getTime())) {
      setError(tr("Перевірте дату дедлайну."));
      return;
    }
    if (
      deadline &&
      deadlineChanged &&
      dateInputEnd(deadline).getTime() <= Date.now()
    ) {
      setError(tr("Дедлайн проєкту має бути в майбутньому."));
      return;
    }
    if (budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
      setError(tr("Максимальний бюджет не може бути меншим за мінімальний."));
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
        categoryName?: string;
        skillNames?: string[];
      } = { title: title.trim(), description };
      if (budgetMin !== "") body.budgetMin = Number(budgetMin);
      if (budgetMax !== "") body.budgetMax = Number(budgetMax);
      if (categoryName.trim()) body.categoryName = categoryName.trim();
      body.skillNames = skillNames;
      if (project && !inModeration(project.status)) body.status = status;
      // Незмінений дедлайн не перезаписуємо, щоб зберегти точність часу в БД.
      if (deadlineChanged)
        body.deadline = deadline ? dateInputEnd(deadline).toISOString() : null;
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
        ← {project ? tr("До проєкту") : tr("Мої проєкти")}
      </Link>
      <div className="page-heading">
        <h1>{project ? tr("Редагувати проєкт") : tr("Створити проєкт")}</h1>
        <p>{tr("Назва обов’язкова. Дедлайн указується за місцевим часом.")}</p>
      </div>
      <section className="data-panel project-form-panel">
        <form onSubmit={submit} aria-busy={submitting}>
          <fieldset className="form-fields" disabled={submitting}>
            <h2 className="form-section-title">{tr("Про проєкт")}</h2>
            <label htmlFor="project-title">
              {tr("Назва проєкту")}
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
              <label htmlFor="project-description">{tr("Опис")}</label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                maxLength={10000}
              />
            </div>
            <h2 className="form-section-title">{tr("Терміни й бюджет")}</h2>
            <label htmlFor="project-deadline">
              {tr("Дедлайн")}
              <input
                id="project-deadline"
                type="date"
                min={
                  keepingOverdueDeadline
                    ? undefined
                    : toDateInput(new Date().toISOString())
                }
                value={deadline}
                onInvalid={(event) => {
                  event.preventDefault();
                  setError(tr("Дедлайн проєкту має бути в майбутньому."));
                }}
                onInput={(event) => {
                  setDeadline(event.currentTarget.value);
                  setError("");
                }}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
            <p className="form-note">
              {tr("Новий дедлайн має бути в майбутньому.")}
            </p>
            <div className="form-row">
              <label>
                {tr("Бюджет від, грн")}
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </label>
              <label>
                {tr("Бюджет до, грн")}
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
              {tr("Категорія")}
              <input
                list="project-category-options"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                minLength={2}
                maxLength={60}
                placeholder={tr("Оберіть зі списку або впишіть свою")}
              />
              <datalist id="project-category-options">
                {categories.data?.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </label>
            <fieldset className="skill-picker">
              <legend className="form-section-title">
                {tr("Потрібні навички")}
              </legend>
              {skillNames.map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      setSkillNames(skillNames.filter((item) => item !== name))
                    }
                    aria-label={tr("Прибрати навичку {0}", name)}
                  />{" "}
                  {name}
                </label>
              ))}
              <div className="skill-picker-add">
                <input
                  list="project-skill-options"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  maxLength={40}
                  placeholder={tr("Оберіть або впишіть навичку")}
                  aria-label={tr("Нова навичка")}
                />
                <datalist id="project-skill-options">
                  {skills.data
                    ?.filter((skill) => !skillNames.includes(skill.name))
                    .map((skill) => (
                      <option key={skill.id} value={skill.name} />
                    ))}
                </datalist>
                <button
                  type="button"
                  className="button secondary"
                  onClick={addSkill}
                  disabled={!skillDraft.trim()}
                >
                  {tr("Додати")}
                </button>
              </div>
            </fieldset>
            {project && inModeration(project.status) && (
              <p className="form-note">
                {project.status === "REJECTED"
                  ? tr(
                      "Після збереження змін проєкт знову піде на модерацію адміністратору.",
                    )
                  : tr(
                      "Проєкт на модерації. Статус можна буде змінити після схвалення адміністратором.",
                    )}
              </p>
            )}
            {project && !inModeration(project.status) && (
              <div className="project-form-field">
                <label htmlFor="edit-project-status">{tr("Статус")}</label>
                <select
                  id="edit-project-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as ProjectStatus)
                  }
                >
                  {Object.entries(projectStatusNames)
                    .filter(([value]) => !inModeration(value as ProjectStatus))
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {tr(label)}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {!project && (
              <p className="form-note">
                {tr(
                  "Спершу проєкт перевірить адміністратор. Після схвалення він отримає статус «Пошук виконавця» і з'явиться на біржі для фрілансерів.",
                )}
              </p>
            )}
            {project && (status === "COMPLETED" || status === "CANCELLED") && (
              <p className="notice">
                {tr(
                  "Після закриття редагування буде недоступне. Для завершення всі завдання мають бути завершені.",
                )}
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            <div className="page-actions form-actions">
              <button className="button primary" type="submit">
                {submitting ? tr("Зберігаємо…") : tr("Зберегти проєкт")}
              </button>
              {!submitting && (
                <Link className="button secondary" to={backUrl}>
                  {tr("Скасувати")}
                </Link>
              )}
            </div>
          </fieldset>
        </form>
      </section>
    </>
  );
}
