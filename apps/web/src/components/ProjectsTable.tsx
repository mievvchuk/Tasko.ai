import { formatDate } from "../format";
import { Link } from "react-router";
import { projectStatusNames } from "../types";
import type { Project } from "../types";

import { useLanguage } from "../i18n";
export function ProjectsTable({ projects }: { projects: Project[] }) {
  const { tr } = useLanguage();
  return (
    <>
      <p className="table-hint">
        {tr("Гортайте таблицю вбік, щоб побачити всі стовпці.")}
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label={tr("Таблиця проєктів")}
        tabIndex={0}
      >
        <table className="projects-table">
          <thead>
            <tr>
              <th scope="col">{tr("Проєкт")}</th>
              <th scope="col">{tr("Статус")}</th>
              <th scope="col">{tr("Завдання")}</th>
              <th scope="col">{tr("Дедлайн")}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="project-name-cell">
                  <strong>
                    <Link to={`/projects/${project.id}`}>{project.title}</Link>
                  </strong>
                  <details className="project-description">
                    <summary>{tr("Опис проєкту")}</summary>
                    <p>{project.description || tr("Опис не додано.")}</p>
                  </details>
                </td>
                <td>
                  <span className={"project-status status-" + project.status}>
                    {tr(projectStatusNames[project.status])}
                  </span>
                </td>
                <td>
                  <div className="task-count">
                    {project.completedTasks} {tr("з")} {project.totalTasks}
                    <span>{project.progress}%</span>
                  </div>
                  <progress
                    className="project-progress"
                    max={100}
                    value={project.progress}
                    aria-label={tr("Виконання проєкту ") + project.title}
                  />
                </td>
                <td>
                  {project.deadline ? (
                    <time
                      dateTime={project.deadline}
                      title={formatDate(project.deadline, true)}
                    >
                      {formatDate(project.deadline)}
                    </time>
                  ) : (
                    <span className="muted">{tr("Не визначено")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
