import type { FormEvent } from "react";
import type { ProjectMember } from "../types";

export function TaskSearchFilters({
  search,
  assigneeId,
  overdue,
  members,
  onChange,
}: {
  search: string;
  assigneeId: string;
  overdue: boolean;
  members: ProjectMember[];
  onChange: (name: string, value: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onChange("search", String(data.get("search") || "").trim());
  }

  return (
    <>
      <form className="task-search" onSubmit={submit}>
        <label htmlFor="task-search">Пошук за назвою</label>
        <div>
          <input
            key={search}
            id="task-search"
            name="search"
            type="search"
            maxLength={200}
            defaultValue={search}
            placeholder="Введіть частину назви"
          />
          <button className="button secondary" type="submit">
            Знайти
          </button>
        </div>
      </form>
      <div className="filter-field">
        <label htmlFor="task-assignee-filter">Виконавець</label>
        <select
          id="task-assignee-filter"
          value={assigneeId}
          onChange={(event) => onChange("assigneeId", event.target.value)}
        >
          <option value="">Усі виконавці</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user?.name || "Учасник недоступний"}
            </option>
          ))}
        </select>
      </div>
      <label className="checkbox-field" htmlFor="task-overdue-filter">
        <input
          id="task-overdue-filter"
          type="checkbox"
          checked={overdue}
          onChange={(event) =>
            onChange("overdue", event.target.checked ? "true" : "")
          }
        />
        Лише прострочені
      </label>
    </>
  );
}
