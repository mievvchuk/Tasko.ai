import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { ResourceState } from "../components/ResourceState";
import type { Project } from "../types";
import {
  PlanMilestoneFields,
  planTotal,
  type Plan,
  type PlanMilestone,
  type PlanTask,
} from "./ProjectPlanFields";
import { formatMoney } from "../format";

import { useLanguage } from "../i18n";
type BusyAction = "generate" | "apply";

// Бюджет для плану і наявні етапи (GET /projects/:id/ai-plan/context)
interface PlanContext {
  limit: number | null;
  source: "BID" | "PROJECT" | null;
  milestones: number;
  replaceableMilestones: number;
  committed: number;
  committedAfterReplace: number;
}

export function ProjectPlanPage() {
  const { id } = useParams();
  // key скидає стан редактора при переході на інший проєкт.
  return <ProjectPlanEditor key={id} />;
}

function ProjectPlanEditor() {
  const { tr } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const project = useApi<Project>(id ? `/projects/${id}` : null);
  const provider = useApi<{ configured: boolean }>("/agent/status");
  const context = useApi<PlanContext>(
    id ? `/projects/${id}/ai-plan/context` : null,
  );
  const [instructions, setInstructions] = useState("");
  // Замінити попередні етапи чи додати до них; null — власник ще не обирав
  const [replaceChoice, setReplaceChoice] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  // Скасовуємо незавершений запит, коли користувач іде зі сторінки.
  useEffect(() => () => controller.current?.abort(), []);

  const owner = Boolean(user) && project.data?.clientId === user?.id;
  const writable =
    project.data && !["COMPLETED", "CANCELLED"].includes(project.data.status);
  const editingLocked = Boolean(busy) || saveAttempted;
  const ctx = context.data;
  const canReplace = Boolean(ctx && ctx.replaceableMilestones > 0);
  // Якщо є що замінити, за замовчуванням план замінює попередні етапи
  const replace = canReplace && (replaceChoice ?? true);
  const available =
    ctx && ctx.limit !== null
      ? Math.max(
          0,
          ctx.limit - (replace ? ctx.committedAfterReplace : ctx.committed),
        )
      : null;
  const total = plan ? planTotal(plan) : 0;
  const invalidAmount = Boolean(
    plan?.milestones.some((m) =>
      m.tasks.some((t) => !Number.isFinite(t.amount)),
    ),
  );
  const overBudget = available !== null && total > available;

  function startRequest(action: BusyAction) {
    submitting.current = true;
    setBusy(action);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    return abort;
  }

  function finishRequest() {
    setBusy(null);
    submitting.current = false;
  }

  function showRequestError(e: unknown, abort: AbortController) {
    if (!abort.signal.aborted) setError(errorMessage(e));
  }

  // Просить AI скласти нову чернетку плану.
  async function generate() {
    if (submitting.current) return;
    const abort = startRequest("generate");
    try {
      const result = await request<Plan>(`/projects/${id}/ai-plan`, {
        method: "POST",
        body: { instructions: instructions.trim(), replace },
        timeoutMs: 45000,
        signal: abort.signal,
      });
      setPlan(result);
      // Новий requestId: сервер за ним відрізняє повторне збереження тієї самої чернетки.
      setRequestId(crypto.randomUUID());
      setSaved(false);
      setSaveAttempted(false);
    } catch (e) {
      showRequestError(e, abort);
    } finally {
      finishRequest();
    }
  }

  // Зберігає підтверджену чернетку як етапи й завдання проєкту.
  async function apply() {
    if (!plan || overBudget || invalidAmount || submitting.current) return;
    const abort = startRequest("apply");
    setSaveAttempted(true);
    try {
      await request(`/projects/${id}/ai-plan/apply`, {
        method: "POST",
        body: { plan, requestId, replace },
        signal: abort.signal,
        timeoutMs: 30000,
      });
      setSaved(true);
      context.refresh();
    } catch (e) {
      showRequestError(e, abort);
      // 400 означає, що сервер точно нічого не зберіг, тож чернетку можна знову редагувати.
      if (e instanceof ApiError && e.status === 400) setSaveAttempted(false);
    } finally {
      finishRequest();
    }
  }

  function changeMilestone(index: number, patch: Partial<PlanMilestone>) {
    setPlan(
      (previous) =>
        previous && {
          milestones: updateAt(previous.milestones, index, patch),
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
            i === milestoneIndex
              ? {
                  ...milestone,
                  tasks: updateAt(milestone.tasks, taskIndex, patch),
                }
              : milestone,
          ),
        },
    );
  }

  function removeMilestone(index: number) {
    setPlan(
      (previous) =>
        previous && {
          milestones: previous.milestones.filter((_, i) => i !== index),
        },
    );
  }

  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("AI-план проєкту")}</h1>
        <p>{project.data?.title}</p>
      </div>
      <ResourceState
        loading={project.loading || provider.loading || context.loading}
        error={project.error || provider.error || context.error}
        onRetry={() => {
          project.refresh();
          provider.refresh();
          context.refresh();
        }}
      />
      {project.data && !owner && (
        <p role="alert" className="notice error">
          {tr("Планування доступне власнику проєкту та адміністратору.")}
        </p>
      )}
      {owner && !writable && (
        <p className="notice">
          {tr("Проєкт закрито. Додавати план уже не можна.")}
        </p>
      )}
      {owner && writable && (
        <>
          <section className="data-panel padded plan-intro">
            <h2>{tr("Від опису до конкретних кроків")}</h2>
            <p>
              {tr(
                "AI використає назву й опис цього проєкту та запропонує етапи, завдання і критерії приймання. Перевірте та відредагуйте чернетку перед додаванням.",
              )}
            </p>
            <p className="plan-note">
              <i className="bi bi-info-circle" aria-hidden="true"></i>
              <span>
                {tr(
                  "AI оцінює вартість кожного завдання, а сума етапу складається з вартостей його завдань. Завдання створюються без виконавців і дедлайнів — їх можна призначити після збереження.",
                )}
              </span>
            </p>
            {ctx && <BudgetNote context={ctx} available={available} />}
            {ctx && ctx.milestones > 0 && (
              <fieldset className="plan-mode" disabled={editingLocked}>
                <legend>
                  {tr("У проєкті вже є етапи: {0}", ctx.milestones)}
                </legend>
                {canReplace ? (
                  <>
                    <label className="plan-mode-option">
                      <input
                        type="radio"
                        name="plan-mode"
                        checked={replace}
                        onChange={() => setReplaceChoice(true)}
                      />
                      <span>
                        <strong>{tr("Замінити попередні етапи")}</strong>
                        <small>
                          {ctx.replaceableMilestones === ctx.milestones
                            ? tr(
                                "Етапи та їхні завдання, які ще ніхто не взяв у роботу, буде видалено й замінено новим планом.",
                              )
                            : tr(
                                "Замінимо етапи, які ще не почали й не оплачували ({0}). Етапи в роботі чи оплачені лишаться.",
                                ctx.replaceableMilestones,
                              )}
                        </small>
                      </span>
                    </label>
                    <label className="plan-mode-option">
                      <input
                        type="radio"
                        name="plan-mode"
                        checked={!replace}
                        onChange={() => setReplaceChoice(false)}
                      />
                      <span>
                        <strong>{tr("Додати до наявних етапів")}</strong>
                        <small>
                          {tr(
                            "Нові етапи стануть після наявних, нічого не видаляється.",
                          )}
                        </small>
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="form-note">
                    {tr(
                      "Наявні етапи вже в роботі або оплачені, тож новий план додасться після них.",
                    )}
                  </p>
                )}
              </fieldset>
            )}
            {!provider.loading &&
              provider.data &&
              !provider.data.configured && (
                <p role="alert" className="notice error">
                  {tr(
                    "AI-провайдер ще не підключений. Зверніться до адміністратора.",
                  )}
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
                {tr("Побажання до плану (необов’язково)")}
              </label>
              <textarea
                id="plan-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={3000}
                rows={2}
                disabled={editingLocked}
                placeholder={tr(
                  "Наприклад: спершу прототип, потім розробка й тестування. Зосередитися на MVP.",
                )}
              />
              <div className="plan-form-bar">
                <small className="form-note">
                  {tr("{0} / 3000 символів", instructions.length)}
                </small>
                <button
                  className="button primary"
                  disabled={editingLocked || !provider.data?.configured}
                >
                  <i className="bi bi-stars" aria-hidden="true"></i>
                  {tr(generateButtonLabel(busy, plan !== null))}
                </button>
              </div>
            </form>
          </section>
          {busy && (
            <p role="status" className="notice">
              {busy === "generate"
                ? tr("AI готує чернетку. Це може тривати до 30 секунд.")
                : tr("Додаємо підтверджений план…")}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {saved && <PlanSavedPanel projectId={id} />}
          {!saved && plan && (
            <form
              className="plan-editor"
              onSubmit={(event) => {
                event.preventDefault();
                void apply();
              }}
            >
              <div className="plan-summary">
                <div>
                  <h2>{tr("Чернетка для перевірки")}</h2>
                  <p>
                    {tr(
                      "Перевірте назви, вартість і критерії приймання — усе можна змінити перед збереженням.",
                    )}
                  </p>
                </div>
                <dl className="plan-stats">
                  <div>
                    <dt>{tr("Етапів")}</dt>
                    <dd>{plan.milestones.length}</dd>
                  </div>
                  <div>
                    <dt>{tr("Завдань")}</dt>
                    <dd>{countTasks(plan)}</dd>
                  </div>
                  <div className={overBudget ? "over" : undefined}>
                    <dt>
                      {available === null
                        ? tr("Сума плану")
                        : tr("Сума плану з {0}", formatMoney(available))}
                    </dt>
                    <dd>{formatMoney(total)}</dd>
                  </div>
                </dl>
              </div>
              {overBudget && (
                <p role="alert" className="notice error">
                  {tr(
                    "Сума плану перевищує доступний бюджет на {0}. Зменште вартість завдань.",
                    formatMoney(total - (available ?? 0)),
                  )}
                </p>
              )}
              {saveAttempted && !busy && (
                <p className="notice">
                  {tr(
                    "Статус збереження невідомий. Повторіть підтвердження — повторний запит не створить дублікати. Редагування цієї чернетки заблоковано до отримання результату.",
                  )}
                </p>
              )}
              {plan.milestones.map((milestone, index) => (
                <PlanMilestoneFields
                  key={index}
                  milestone={milestone}
                  index={index}
                  disabled={editingLocked}
                  canRemove={plan.milestones.length > 1}
                  onChange={(patch) => changeMilestone(index, patch)}
                  onChangeTask={(taskIndex, patch) =>
                    changeTask(index, taskIndex, patch)
                  }
                  onRemove={() => removeMilestone(index)}
                />
              ))}
              <div className="plan-actions">
                <button
                  className="button primary"
                  disabled={Boolean(busy) || overBudget || invalidAmount}
                >
                  {tr(applyButtonLabel(busy, saveAttempted, replace))}
                </button>
                <p className="form-note">
                  {replace
                    ? tr(
                        "Попередні етапи, які ще не почали, буде замінено етапами й завданнями цієї чернетки.",
                      )
                    : tr(
                        "Після підтвердження буде створено всі етапи та завдання цієї чернетки.",
                      )}
                </p>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}

function PlanSavedPanel({ projectId }: { projectId?: string }) {
  const { tr } = useLanguage();
  return (
    <section className="data-panel padded" role="status">
      <h2>{tr("План додано до проєкту")}</h2>
      <p>
        {tr(
          "Етапи та завдання збережено разом із критеріями приймання в описах.",
        )}
      </p>
      <div className="plan-actions">
        <Link className="button primary" to={`/projects/${projectId}/board`}>
          {tr("Відкрити Kanban")}
        </Link>
        <Link
          className="button secondary"
          to={`/projects/${projectId}/milestones`}
        >
          {tr("Переглянути етапи")}
        </Link>
      </div>
    </section>
  );
}

// Повертає копію масиву, у якій елемент з index змінено полями з patch.
function updateAt<T extends object>(
  items: T[],
  index: number,
  patch: Partial<T>,
): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function countTasks(plan: Plan) {
  return plan.milestones.reduce(
    (sum, milestone) => sum + milestone.tasks.length,
    0,
  );
}

function generateButtonLabel(busy: BusyAction | null, hasPlan: boolean) {
  if (busy === "generate") return "Складаємо план…";
  if (hasPlan) return "Згенерувати інший план";
  return "Запропонувати план";
}

function applyButtonLabel(
  busy: BusyAction | null,
  saveAttempted: boolean,
  replace: boolean,
) {
  if (busy === "apply") return "Зберігаємо…";
  if (saveAttempted) return "Повторити підтвердження";
  if (replace) return "Замінити попередні етапи";
  return "Підтвердити й додати до проєкту";
}

// Звідки взято межу суми плану і скільки ще можна розподілити
function BudgetNote({
  context,
  available,
}: {
  context: PlanContext;
  available: number | null;
}) {
  const { tr } = useLanguage();
  return (
    <p className="plan-budget">
      <i className="bi bi-cash-coin" aria-hidden="true"></i>
      <span>
        {context.limit === null ? (
          tr(
            "Бюджет у проєкті не вказано, тож AI оцінить вартість завдань за ринковими цінами. Суми можна змінити вручну.",
          )
        ) : (
          <>
            {context.source === "BID"
              ? tr(
                  "Ціна, погоджена з виконавцем: {0}.",
                  formatMoney(context.limit),
                )
              : tr("Бюджет проєкту: {0}.", formatMoney(context.limit))}{" "}
            <strong>
              {tr(
                "Для нового плану доступно {0}.",
                formatMoney(available ?? 0),
              )}
            </strong>{" "}
            {tr("Сума всіх завдань не може бути більшою.")}
          </>
        )}
      </span>
    </p>
  );
}
