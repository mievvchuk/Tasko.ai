import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, errorMessage, request } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { ResourceState } from "../components/ResourceState";
import type { Project } from "../types";
import {
  PlanMilestoneFields,
  type Plan,
  type PlanMilestone,
  type PlanTask,
} from "./ProjectPlanFields";

type BusyAction = "generate" | "apply";

export function ProjectPlanPage() {
  const { id } = useParams();
  // key скидає стан редактора при переході на інший проєкт.
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
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  // Скасовуємо незавершений запит, коли користувач іде зі сторінки.
  useEffect(() => () => controller.current?.abort(), []);

  const owner =
    user?.role === "ADMIN" ||
    (Boolean(user) && project.data?.clientId === user?.id);
  const writable =
    project.data && !["COMPLETED", "CANCELLED"].includes(project.data.status);
  const editingLocked = Boolean(busy) || saveAttempted;

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
        body: { instructions: instructions.trim() },
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
    if (!plan || submitting.current) return;
    const abort = startRequest("apply");
    setSaveAttempted(true);
    try {
      await request(`/projects/${id}/ai-plan/apply`, {
        method: "POST",
        body: { plan, requestId },
        signal: abort.signal,
        timeoutMs: 30000,
      });
      setSaved(true);
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
                disabled={editingLocked}
                placeholder="Наприклад: спершу прототип, потім розробка й тестування. Зосередитися на MVP."
              />
              <button
                className="button primary"
                disabled={editingLocked || !provider.data?.configured}
              >
                {generateButtonLabel(busy, plan !== null)}
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
                <strong>Чернетка для перевірки</strong>
                <span>Етапів: {plan.milestones.length}</span>
                <span>Завдань: {countTasks(plan)}</span>
              </div>
              {saveAttempted && !busy && (
                <p className="notice">
                  Статус збереження невідомий. Повторіть підтвердження —
                  повторний запит не створить дублікати. Редагування цієї
                  чернетки заблоковано до отримання результату.
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
                <button className="button primary" disabled={Boolean(busy)}>
                  {applyButtonLabel(busy, saveAttempted)}
                </button>
                <p className="form-note">
                  Після підтвердження буде створено всі етапи та завдання цієї
                  чернетки.
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
  return (
    <section className="data-panel padded" role="status">
      <h2>План додано до проєкту</h2>
      <p>Етапи та завдання збережено разом із критеріями приймання в описах.</p>
      <div className="plan-actions">
        <Link className="button primary" to={`/projects/${projectId}/board`}>
          Відкрити Kanban
        </Link>
        <Link
          className="button secondary"
          to={`/projects/${projectId}/milestones`}
        >
          Переглянути етапи
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

function applyButtonLabel(busy: BusyAction | null, saveAttempted: boolean) {
  if (busy === "apply") return "Зберігаємо…";
  if (saveAttempted) return "Повторити підтвердження";
  return "Підтвердити й додати до проєкту";
}
