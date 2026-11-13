import type { ProjectStatus } from "../types";
import { useLanguage } from "../i18n";

// Шлях проєкту на платформі: де він зараз і що далі. Етап виводиться зі статусу проєкту.
const stages = [
  "Публікація",
  "Приймання заявок",
  "Виконання",
  "Завершено",
] as const;

type StageState = "done" | "current" | "todo" | "stopped";

export function stageStates(status: ProjectStatus): StageState[] {
  const current: Record<ProjectStatus, number> = {
    MODERATION: 0,
    REJECTED: 0,
    PLANNING: 1,
    ACTIVE: 2,
    PAUSED: 2,
    COMPLETED: 4,
    CANCELLED: -1,
  };
  const at = current[status];
  return stages.map((_, index) => {
    if (at === -1) return "stopped";
    if (index < at) return "done";
    if (index === at)
      return status === "REJECTED" || status === "PAUSED"
        ? "stopped"
        : "current";
    return "todo";
  });
}

export function ProjectStages({
  status,
  hiringOpen,
}: {
  status: ProjectStatus;
  hiringOpen?: boolean;
}) {
  const { tr } = useLanguage();
  const states = stageStates(status);
  const done = states.filter((state) => state === "done").length;
  const notes: Record<StageState, string> = {
    done: tr("Виконано"),
    current: tr("Зараз"),
    todo: "",
    stopped:
      status === "REJECTED"
        ? tr("Відхилено")
        : status === "PAUSED"
          ? tr("Призупинено")
          : tr("Скасовано"),
  };
  return (
    <section className="project-stages" aria-label={tr("Етапи проєкту")}>
      <div className="project-stages-head">
        <span
          className="project-stages-ring"
          style={{
            background: `conic-gradient(var(--data-green) ${(done / stages.length) * 100}%, var(--color-paper-3) 0)`,
          }}
        >
          <span>
            {done}/{stages.length}
          </span>
        </span>
        <strong>{tr("Етапи проєкту")}</strong>
      </div>
      <ol>
        {stages.map((stage, index) => (
          <li key={stage} className={`stage-${states[index]}`}>
            <i aria-hidden="true" />
            <span>
              {tr(stage)}
              {index === 2 && status === "ACTIVE" && hiringOpen && (
                <small>{tr("ще добирають команду")}</small>
              )}
            </span>
            <em>{notes[states[index]]}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}
