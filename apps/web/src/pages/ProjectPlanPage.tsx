import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { ResourceState } from "../components/ResourceState";
import type { Project } from "../types";

interface PlanTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  acceptanceCriteria: string[];
}
interface PlanMilestone {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: PlanTask[];
}
interface Plan {
  milestones: PlanMilestone[];
}

export function ProjectPlanPage() {
  const { id } = useParams();
  return <ProjectPlanEditor key={id} />;
}

function ProjectPlanEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const provider = useApi<{ configured: boolean }>("/agent/status");
  const [instructions, setInstructions] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState<"generate" | "apply" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const owner =
    user?.role === "ADMIN" ||
    (Boolean(user) && project.data?.clientId === user?.id);
  const writable =
    project.data && !["COMPLETED", "CANCELLED"].includes(project.data.status);

  async function generate() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy("generate");
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const result = await request<Plan>(`/projects/${id}/ai-plan`, {
        method: "POST",
        body: { instructions: instructions.trim() },
        timeoutMs: 45000,
        signal: abort.signal,
      });
      setPlan(result);
      setRequestId(crypto.randomUUID());
      setSaved(false);
      setSaveAttempted(false);
    } catch (e) {
      if (!abort.signal.aborted) setError(errorMessage(e));
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }

  async function apply() {
    if (!plan || submitting.current) return;
    submitting.current = true;
    setBusy("apply");
    setError("");
    setSaveAttempted(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      await request(`/projects/${id}/ai-plan/apply`, {
        method: "POST",
        body: { plan, requestId },
        signal: abort.signal,
        timeoutMs: 30000,
      });
      setSaved(true);
    } catch (e) {
      if (!abort.signal.aborted) setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 400) setSaveAttempted(false);
    } finally {
      setBusy(null);
      submitting.current = false;
    }
  }

  function changeMilestone(index: number, patch: Partial<PlanMilestone>) {
    setPlan(
      (previous) =>
        previous && {
          milestones: previous.milestones.map((item, i) =>
            i === index ? { ...item, ...patch } : item,
          ),
        },
    );
  }
  function changeTask(
    milestoneIndex: number,
    taskIndex: number,
    patch: Partial<PlanTask>,
  ) {
    setPlan(
      (previous) =>
        previous && {
          milestones: previous.milestones.map((milestone, i) =>
            i !== milestoneIndex
              ? milestone
              : {
                  ...milestone,
                  tasks: milestone.tasks.map((task, j) =>
                    j === taskIndex ? { ...task, ...patch } : task,
                  ),
                },
          ),
        },
    );
  }

  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / ПЛАНУВАННЯ</span>
        <h1>AI-план проєкту</h1>
        <p>{project.data?.title}</p>
      </div>
      <ResourceState
        loading={project.loading || provider.loading}
        error={project.error || provider.error}
        onRetry={() => {
          project.refresh();
          provider.refresh();
        }}
      />
      {project.data && !owner && (
        <p role="alert" className="notice error">
          Планування доступне власнику проєкту та адміністратору.
        </p>
      )}
      {owner && !writable && (
        <p className="notice">Проєкт закрито. Додавати план уже не можна.</p>
      )}
      {owner && writable && (
        <>
          <section className="data-panel padded plan-intro">
            <h2>Від опису до конкретних кроків</h2>
            <p>
              AI використає назву й опис цього проєкту та запропонує етапи,
              завдання і критерії приймання. Перевірте та відредагуйте чернетку
              перед додаванням.
            </p>
            <p className="form-note">
              Завдання створюються без виконавців і дедлайнів, етапи — з сумою 0
              грн. Призначити виконавців і строки завдань можна у формах їх
              редагування після збереження.
            </p>
            {!provider.loading &&
              provider.data &&
              !provider.data.configured && (
                <p role="alert" className="notice error">
                  AI-провайдер ще не підключений. Зверніться до адміністратора.
                </p>
              )}
            <form
              className="work-form"
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
            >
              <label htmlFor="plan-instructions">
                Побажання до плану (необов’язково)
              </label>
              <textarea
                id="plan-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={3000}
                rows={3}
                disabled={Boolean(busy) || saveAttempted}
                placeholder="Наприклад: спершу прототип, потім розробка й тестування. Зосередитися на MVP."
              />
              <button
                className="button primary"
                disabled={
                  Boolean(busy) || !provider.data?.configured || saveAttempted
                }
              >
                {busy === "generate"
                  ? "Складаємо план…"
                  : plan
                    ? "Згенерувати інший план"
                    : "Запропонувати план"}
              </button>
            </form>
          </section>
          {busy && (
            <p role="status" className="notice">
              {busy === "generate"
                ? "AI готує чернетку. Це може тривати до 30 секунд."
                : "Додаємо підтверджений план…"}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {saved ? (
            <section className="data-panel padded" role="status">
              <h2>План додано до проєкту</h2>
              <p>
                Етапи та завдання збережено разом із критеріями приймання в
                описах.
              </p>
              <div className="plan-actions">
                <Link className="button primary" to={`/projects/${id}/board`}>
                  Відкрити Kanban
                </Link>
                <Link
                  className="button secondary"
                  to={`/projects/${id}/milestones`}
                >
                  Переглянути етапи
                </Link>
              </div>
            </section>
          ) : (
            plan && (
              <form
                className="plan-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  void apply();
                }}
              >
                <div className="plan-summary">
                  <strong>Чернетка для перевірки</strong>
                  <span>Етапів: {plan.milestones.length}</span>
                  <span>
                    Завдань:{" "}
                    {plan.milestones.reduce(
                      (sum, item) => sum + item.tasks.length,
                      0,
                    )}
                  </span>
                </div>
                {saveAttempted && !busy && (
                  <p className="notice">
                    Статус збереження невідомий. Повторіть підтвердження —
                    повторний запит не створить дублікати. Редагування цієї
                    чернетки заблоковано до отримання результату.
                  </p>
                )}
                {plan.milestones.map((milestone, mi) => (
                  <fieldset
                    key={mi}
                    className="plan-milestone"
                    disabled={Boolean(busy) || saveAttempted}
                  >
                    <legend>Етап {mi + 1}</legend>
                    <div className="work-form">
                      <label htmlFor={`milestone-title-${mi}`}>
                        Назва етапу
                      </label>
                      <input
                        id={`milestone-title-${mi}`}
                        required
                        minLength={2}
                        maxLength={200}
                        value={milestone.title}
                        onChange={(e) =>
                          changeMilestone(mi, { title: e.target.value })
                        }
                      />
                      <label htmlFor={`milestone-description-${mi}`}>
                        Опис етапу
                      </label>
                      <textarea
                        id={`milestone-description-${mi}`}
                        required
                        minLength={2}
                        maxLength={3000}
                        value={milestone.description}
                        onChange={(e) =>
                          changeMilestone(mi, { description: e.target.value })
                        }
                      />
                      <label htmlFor={`milestone-criteria-${mi}`}>
                        Критерії приймання етапу — по одному на рядок
                      </label>
                      <textarea
                        id={`milestone-criteria-${mi}`}
                        required
                        maxLength={2405}
                        value={milestone.acceptanceCriteria.join("\n")}
                        onChange={(e) =>
                          changeMilestone(mi, {
                            acceptanceCriteria: e.target.value.split("\n"),
                          })
                        }
                      />
                    </div>
                    {milestone.tasks.map((task, ti) => (
                      <section className="plan-task" key={ti}>
                        <h3>
                          Завдання {mi + 1}.{ti + 1}
                        </h3>
                        <div className="work-form">
                          <label htmlFor={`task-title-${mi}-${ti}`}>
                            Назва завдання
                          </label>
                          <input
                            id={`task-title-${mi}-${ti}`}
                            required
                            minLength={2}
                            maxLength={200}
                            value={task.title}
                            onChange={(e) =>
                              changeTask(mi, ti, { title: e.target.value })
                            }
                          />
                          <label htmlFor={`task-description-${mi}-${ti}`}>
                            Опис роботи
                          </label>
                          <textarea
                            id={`task-description-${mi}-${ti}`}
                            required
                            minLength={2}
                            maxLength={3000}
                            value={task.description}
                            onChange={(e) =>
                              changeTask(mi, ti, {
                                description: e.target.value,
                              })
                            }
                          />
                          <label htmlFor={`task-priority-${mi}-${ti}`}>
                            Пріоритет
                          </label>
                          <select
                            id={`task-priority-${mi}-${ti}`}
                            value={task.priority}
                            onChange={(e) =>
                              changeTask(mi, ti, {
                                priority: e.target
                                  .value as PlanTask["priority"],
                              })
                            }
                          >
                            <option value="LOW">Низький</option>
                            <option value="MEDIUM">Середній</option>
                            <option value="HIGH">Високий</option>
                          </select>
                          <label htmlFor={`task-criteria-${mi}-${ti}`}>
                            Критерії приймання — по одному на рядок
                          </label>
                          <textarea
                            id={`task-criteria-${mi}-${ti}`}
                            required
                            maxLength={2405}
                            value={task.acceptanceCriteria.join("\n")}
                            onChange={(e) =>
                              changeTask(mi, ti, {
                                acceptanceCriteria: e.target.value.split("\n"),
                              })
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="text-button"
                          disabled={milestone.tasks.length <= 1}
                          onClick={() =>
                            changeMilestone(mi, {
                              tasks: milestone.tasks.filter((_, j) => j !== ti),
                            })
                          }
                        >
                          Прибрати завдання
                        </button>
                      </section>
                    ))}
                    <div className="plan-actions section-gap">
                      <button
                        type="button"
                        className="button secondary"
                        disabled={milestone.tasks.length >= 8}
                        onClick={() =>
                          changeMilestone(mi, {
                            tasks: [
                              ...milestone.tasks,
                              {
                                title: "",
                                description: "",
                                priority: "MEDIUM",
                                acceptanceCriteria: [""],
                              },
                            ],
                          })
                        }
                      >
                        Додати завдання
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={plan.milestones.length <= 1}
                        onClick={() =>
                          setPlan({
                            milestones: plan.milestones.filter(
                              (_, i) => i !== mi,
                            ),
                          })
                        }
                      >
                        Прибрати етап
                      </button>
                    </div>
                  </fieldset>
                ))}
                <div className="plan-actions">
                  <button className="button primary" disabled={Boolean(busy)}>
                    {busy === "apply"
                      ? "Зберігаємо…"
                      : saveAttempted
                        ? "Повторити підтвердження"
                        : "Підтвердити й додати до проєкту"}
                  </button>
                  <p className="form-note">
                    Після підтвердження буде створено всі етапи та завдання цієї
                    чернетки.
                  </p>
                </div>
              </form>
            )
          )}
        </>
      )}
    </>
  );
}
