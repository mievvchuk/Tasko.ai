import { useState } from "react";
import { useApi } from "../useApi";
import { projectStatusNames } from "../types";
import type { Project } from "../types";
import { Pagination, ResourceState } from "./ResourceState";

import { useLanguage } from "../i18n";

// Вибір проєкту плитками: назва, статус і прогрес видно одразу, обраний підсвічено
export function ProjectPicker({
  value,
  onChange,
  selected,
}: {
  value: string;
  onChange: (value: string) => void;
  selected?: Project | null;
}) {
  const { tr } = useLanguage();
  const [page, setPage] = useState(1);
  const projects = useApi<Project[]>(`/projects?page=${page}&limit=20`);
  return (
    <section className="project-picker" aria-label={tr("Проєкт")}>
      <ResourceState
        loading={projects.loading}
        error={projects.error}
        onRetry={projects.refresh}
      />
      {projects.data && (
        <>
          <div className="project-picker-grid" role="radiogroup">
            {value &&
              selected &&
              !projects.data.some((project) => project.id === value) && (
                <PickerCard project={selected} active onPick={() => {}} />
              )}
            {projects.data.map((project) => (
              <PickerCard
                key={project.id}
                project={project}
                active={project.id === value}
                onPick={() => onChange(project.id === value ? "" : project.id)}
              />
            ))}
          </div>
          {!projects.data.length && (
            <p className="form-note">
              {tr("На цій сторінці немає доступних проєктів.")}
            </p>
          )}
          {(page > 1 || projects.data.length === 20) && (
            <Pagination
              page={page}
              count={projects.data.length}
              onChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}

function PickerCard({
  project,
  active,
  onPick,
}: {
  project: Project;
  active: boolean;
  onPick: () => void;
}) {
  const { tr } = useLanguage();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      className={active ? "picker-card active" : "picker-card"}
      onClick={onPick}
    >
      <strong>{project.title}</strong>
      <span className={"project-status status-" + project.status}>
        {tr(projectStatusNames[project.status])}
      </span>
      <progress max={100} value={project.progress} aria-hidden="true" />
    </button>
  );
}
