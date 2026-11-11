import { useLanguage } from "../i18n"; // Поля редактора AI-плану: етап, завдання та критерії приймання.

export interface PlanTask {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  acceptanceCriteria: string[];
  // Значення полів форми: порожньо — «ні», ще не визначено
  deadline?: string;
}
export interface PlanMilestone {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: PlanTask[];
  amount?: string;
  deadline?: string;
}
export interface Plan {
  milestones: PlanMilestone[];
}

const maxTasksPerMilestone = 8;

function createEmptyTask(): PlanTask {
  return {
    title: "",
    description: "",
    priority: "MEDIUM",
    acceptanceCriteria: [""],
  };
}

// Бюджет і дедлайн: необов'язкові, порожнє поле підписане «ні»
function TermsFields({
  id,
  amount,
  deadline,
  onChange,
}: {
  id: string;
  amount?: string;
  deadline?: string;
  onChange: (patch: { amount?: string; deadline?: string }) => void;
}) {
  const { tr } = useLanguage();
  const unset = <small className="plan-unset">{tr("ні")}</small>;
  return (
    <div className="plan-terms">
      {amount !== undefined && (
        <label htmlFor={`${id}-amount`}>
          <span>
            {tr("Бюджет, грн")} {!amount && unset}
          </span>
          <input
            id={`${id}-amount`}
            type="number"
            inputMode="numeric"
            min={0}
            max={10000000}
            step={1}
            placeholder={tr("ні")}
            value={amount}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
        </label>
      )}
      <label htmlFor={`${id}-deadline`}>
        <span>
          {tr("Дедлайн")} {!deadline && unset}
        </span>
        <input
          id={`${id}-deadline`}
          type="date"
          value={deadline ?? ""}
          onChange={(e) => onChange({ deadline: e.target.value })}
        />
      </label>
    </div>
  );
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
      <textarea
        id={id}
        required
        maxLength={2405}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
      />
    </>
  );
}

function PlanTaskFields({
  task,
  milestoneIndex,
  taskIndex,
  canRemove,
  onChange,
  onRemove,
}: {
  task: PlanTask;
  milestoneIndex: number;
  taskIndex: number;
  canRemove: boolean;
  onChange: (patch: Partial<PlanTask>) => void;
  onRemove: () => void;
}) {
  const { tr } = useLanguage();
  const idSuffix = `${milestoneIndex}-${taskIndex}`;
  return (
    <section className="plan-task">
      <h3>
        {tr("Завдання")} {milestoneIndex + 1}.{taskIndex + 1}
      </h3>
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
        <label htmlFor={`task-description-${idSuffix}`}>
          {tr("Опис роботи")}
        </label>
        <textarea
          id={`task-description-${idSuffix}`}
          required
          minLength={2}
          maxLength={3000}
          value={task.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <label htmlFor={`task-priority-${idSuffix}`}>{tr("Пріоритет")}</label>
        <select
          id={`task-priority-${idSuffix}`}
          value={task.priority}
          onChange={(e) =>
            onChange({ priority: e.target.value as PlanTask["priority"] })
          }
        >
          <option value="LOW">{tr("Низький")}</option>
          <option value="MEDIUM">{tr("Середній")}</option>
          <option value="HIGH">{tr("Високий")}</option>
        </select>
        <TermsFields
          id={`task-${idSuffix}`}
          deadline={task.deadline}
          onChange={onChange}
        />
        <CriteriaField
          id={`task-criteria-${idSuffix}`}
          label={tr("Критерії приймання — по одному на рядок")}
          value={task.acceptanceCriteria}
          onChange={(acceptanceCriteria) => onChange({ acceptanceCriteria })}
        />
      </div>
      <button
        type="button"
        className="text-button"
        disabled={!canRemove}
        onClick={onRemove}
      >
        <i className="bi bi-trash" aria-hidden="true"></i>

        {tr("Прибрати завдання")}
      </button>
    </section>
  );
}

export function PlanMilestoneFields({
  milestone,
  index,
  disabled,
  canRemove,
  onChange,
  onChangeTask,
  onRemove,
}: {
  milestone: PlanMilestone;
  index: number;
  disabled: boolean;
  canRemove: boolean;
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
      <legend>
        {tr("Етап")} {index + 1}
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
        <label htmlFor={`milestone-description-${index}`}>
          {tr("Опис етапу")}
        </label>
        <textarea
          id={`milestone-description-${index}`}
          required
          minLength={2}
          maxLength={3000}
          value={milestone.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <TermsFields
          id={`milestone-${index}`}
          amount={milestone.amount ?? ""}
          deadline={milestone.deadline}
          onChange={onChange}
        />
        <CriteriaField
          id={`milestone-criteria-${index}`}
          label={tr("Критерії приймання етапу — по одному на рядок")}
          value={milestone.acceptanceCriteria}
          onChange={(acceptanceCriteria) => onChange({ acceptanceCriteria })}
        />
      </div>
      {tasks.map((task, taskIndex) => (
        <PlanTaskFields
          key={taskIndex}
          task={task}
          milestoneIndex={index}
          taskIndex={taskIndex}
          canRemove={tasks.length > 1}
          onChange={(patch) => onChangeTask(taskIndex, patch)}
          onRemove={() => removeTask(taskIndex)}
        />
      ))}
      <div className="plan-actions section-gap">
        <button
          type="button"
          className="button secondary"
          disabled={tasks.length >= maxTasksPerMilestone}
          onClick={addTask}
        >
          <i className="bi bi-plus-lg" aria-hidden="true"></i>

          {tr("Додати завдання")}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={!canRemove}
          onClick={onRemove}
        >
          <i className="bi bi-trash" aria-hidden="true"></i>

          {tr("Прибрати етап")}
        </button>
      </div>
    </fieldset>
  );
}
