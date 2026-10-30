import type { FormEvent } from "react";
import type { ProjectMember } from "../types";

import { useLanguage } from "../i18n";
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
  const { tr } = useLanguage();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onChange("search", String(data.get("search") || "").trim());
  }

  return (
    <>
      <form className="task-search" onSubmit={submit}>
        <label htmlFor="task-search">{tr("Пошук за назвою")}</label>
        <div>
          <input
            key={search}
            id="task-search"
            name="search"
            type="search"
            maxLength={200}
            defaultValue={search}
            placeholder={tr("Введіть частину назви")}
          />
          <button className="button secondary" type="submit">
            {tr("Знайти")}
          </button>
        </div>
      </form>
      <div className="filter-field">
        <label htmlFor="task-assignee-filter">{tr("Виконавець")}</label>
        <select
          id="task-assignee-filter"
          value={assigneeId}
          onChange={(event) => onChange("assigneeId", event.target.value)}
        >
          <option value="">{tr("Усі виконавці")}</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user?.name || tr("Учасник недоступний")}
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

        {tr("Лише прострочені")}
      </label>
    </>
  );
}
