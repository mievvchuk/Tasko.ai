import { useState } from "react";
import { useApi } from "../useApi";
import type { Project } from "../types";
import { Pagination, ResourceState } from "./ResourceState";

import { useLanguage } from "../i18n";
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
    <section className="data-panel project-picker">
      <label htmlFor="selected-project">{tr("Проєкт")}</label>
      <ResourceState
        loading={projects.loading}
        error={projects.error}
        onRetry={projects.refresh}
      />
      {projects.data && (
        <>
          <select
            id="selected-project"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">{tr("Виберіть проєкт")}</option>
            {value &&
              !projects.data.some((project) => project.id === value) && (
                <option value={value}>
                  {selected?.title || tr("Обраний проєкт")}
                </option>
              )}
            {projects.data.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
          {!projects.data.length && (
            <p className="form-note">
              {tr("На цій сторінці немає доступних проєктів.")}
            </p>
          )}
          <Pagination
            page={page}
            count={projects.data.length}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
