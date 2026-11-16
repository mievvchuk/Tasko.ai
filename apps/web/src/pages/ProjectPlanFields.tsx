import { useLanguage } from "../i18n";
import { formatMoney } from "../format";
import { ratingStars } from "../types";

// Поля редактора AI-плану: етап, завдання та критерії приймання.

export interface PlanTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  // Вартість завдання, грн; сума етапу — сума його завдань
  amount: number;
  // Рейтинг 1–5 і дедлайн (YYYY-MM-DD), які пропонує AI; null — не задано
  rating: number | null;
  deadline: string | null;
  acceptanceCriteria: string[];
}
export interface PlanMilestone {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: PlanTask[];
}
export interface Plan {
  milestones: PlanMilestone[];
}

export function milestoneTotal(milestone: PlanMilestone) {
  return milestone.tasks.reduce((sum, task) => sum + (task.amount || 0), 0);
}

export function planTotal(plan: Plan) {
  return plan.milestones.reduce((sum, item) => sum + milestoneTotal(item), 0);
}

const maxTasksPerMilestone = 8;

function createEmptyTask(): PlanTask {
  return {
    title: "",
    description: "",
    priority: "MEDIUM",
    amount: 0,
    rating: null,
    deadline: null,
    acceptanceCriteria: [""],
  };
}

// Критерії зберігаються як масив рядків, а в полі показуються по одному на рядок.
function CriteriaField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (criteria: string[]) => void;
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} required maxLength={2405} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} />
    </>
  );
}

function PlanTaskFields({
  task,
  milestoneIndex,
  taskIndex,
  canRemove,
  maxDate,
  onChange,
  onRemove,
}: {
  task: PlanTask;
  milestoneIndex: number;
  taskIndex: number;
  canRemove: boolean;
  maxDate?: string;
  onChange: (patch: Partial<PlanTask>) => void;
  onRemove: () => void;
}) {
  const { tr } = useLanguage();
  const idSuffix = `${milestoneIndex}-${taskIndex}`;
  return (
    <section className="plan-task">
      <div className="plan-task-head">
        <h4>
          {tr("Завдання")} {milestoneIndex + 1}.{taskIndex + 1}
        </h4>
        <button
          type="button"
          className="text-button"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={tr("Прибрати завдання {0}", `${milestoneIndex + 1}.${taskIndex + 1}`)}
        >
          <i className="bi bi-trash" aria-hidden="true"></i>
          {tr("Прибрати")}
        </button>
      </div>
      <div className="work-form">
        <label htmlFor={`task-title-${idSuffix}`}>{tr("Назва завдання")}</label>
        <input
          id={`task-title-${idSuffix}`}
          required
          minLength={2}
          maxLength={200}
          value={task.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <label htmlFor={`task-description-${idSuffix}`}>{tr("Опис роботи")}</label>
        <textarea
          id={`task-description-${idSuffix}`}
          required
          minLength={2}
          maxLength={3000}
          value={task.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <div className="plan-task-meta">
          <div>
            <label htmlFor={`task-priority-${idSuffix}`}>{tr("Пріоритет")}</label>
            <select
              id={`task-priority-${idSuffix}`}
              value={task.priority}
              onChange={(e) => onChange({ priority: e.target.value as PlanTask["priority"] })}
            >
              <option value="LOW">{tr("Низький")}</option>
              <option value="MEDIUM">{tr("Середній")}</option>
              <option value="HIGH">{tr("Високий")}</option>
            </select>
          </div>
          <div>
            <label htmlFor={`task-amount-${idSuffix}`}>{tr("Вартість, грн")}</label>
            <input
              id={`task-amount-${idSuffix}`}
              type="number"
              inputMode="numeric"
              required
              min={0}
              max={100000000}
              step={1}
              value={Number.isFinite(task.amount) ? task.amount : ""}
              onChange={(e) =>
                onChange({
                  amount: e.target.value === "" ? Number.NaN : Math.max(0, Math.floor(Number(e.target.value))),
                })
              }
            />
          </div>
          <div>
            <label htmlFor={`task-rating-${idSuffix}`}>{tr("Рейтинг")}</label>
            <select
              id={`task-rating-${idSuffix}`}
              value={task.rating ?? ""}
              onChange={(e) =>
                onChange({
                  rating: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{tr("Не задано")}</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {ratingStars(value)} ({value})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`task-deadline-${idSuffix}`}>{tr("Дедлайн")}</label>
            <input
              id={`task-deadline-${idSuffix}`}
              type="date"
              max={maxDate}
              value={task.deadline ?? ""}
              onChange={(e) => onChange({ deadline: e.target.value || null })}
            />
          </div>
        </div>
        <CriteriaField
          id={`task-criteria-${idSuffix}`}
          label={tr("Критерії приймання — по одному на рядок")}
          value={task.acceptanceCriteria}
          onChange={(acceptanceCriteria) => onChange({ acceptanceCriteria })}
        />
      </div>
    </section>
  );
}

export function PlanMilestoneFields({
  milestone,
  index,
  disabled,
  canRemove,
  maxDate,
  onChange,
  onChangeTask,
  onRemove,
}: {
  milestone: PlanMilestone;
  index: number;
  disabled: boolean;
  canRemove: boolean;
  // Дедлайн проєкту (YYYY-MM-DD): завдання не можуть закінчуватись пізніше
  maxDate?: string;
  onChange: (patch: Partial<PlanMilestone>) => void;
  onChangeTask: (taskIndex: number, patch: Partial<PlanTask>) => void;
  onRemove: () => void;
}) {
  const { tr } = useLanguage();
  const tasks = milestone.tasks;

  function addTask() {
    onChange({ tasks: [...tasks, createEmptyTask()] });
  }

  function removeTask(taskIndex: number) {
    onChange({ tasks: tasks.filter((_, i) => i !== taskIndex) });
  }

  return (
    <fieldset className="plan-milestone" disabled={disabled}>
      {/* legend усередині картки (а не на її рамці) — разом із сумою етапу */}
      <legend className="plan-milestone-head">
        <span className="plan-step">{index + 1}</span>
        <span>{milestone.title.trim() || tr("Етап {0}", index + 1)}</span>
        <strong className="plan-amount">{formatMoney(milestoneTotal(milestone))}</strong>
      </legend>
      <div className="work-form">
        <label htmlFor={`milestone-title-${index}`}>{tr("Назва етапу")}</label>
        <input
          id={`milestone-title-${index}`}
          required
          minLength={2}
          maxLength={200}
          value={milestone.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <label htmlFor={`milestone-description-${index}`}>{tr("Опис етапу")}</label>
        <textarea
          id={`milestone-description-${index}`}
          required
          minLength={2}
          maxLength={3000}
          value={milestone.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <CriteriaField
          id={`milestone-criteria-${index}`}
          label={tr("Критерії приймання етапу — по одному на рядок")}
          value={milestone.acceptanceCriteria}
          onChange={(acceptanceCriteria) => onChange({ acceptanceCriteria })}
        />
      </div>
      <h3 className="plan-tasks-title">
        {tr("Завдання етапу")} <span>{tasks.length}</span>
      </h3>
      {tasks.map((task, taskIndex) => (
        <PlanTaskFields
          key={taskIndex}
          task={task}
          milestoneIndex={index}
          taskIndex={taskIndex}
          canRemove={tasks.length > 1}
          maxDate={maxDate}
          onChange={(patch) => onChangeTask(taskIndex, patch)}
          onRemove={() => removeTask(taskIndex)}
        />
      ))}
      <div className="plan-actions section-gap">
        <button type="button" className="button secondary" disabled={tasks.length >= maxTasksPerMilestone} onClick={addTask}>
          <i className="bi bi-plus-lg" aria-hidden="true"></i>

          {tr("Додати завдання")}
        </button>
        <button type="button" className="text-button" disabled={!canRemove} onClick={onRemove}>
          <i className="bi bi-trash" aria-hidden="true"></i>

          {tr("Прибрати етап")}
        </button>
      </div>
    </fieldset>
  );
}
