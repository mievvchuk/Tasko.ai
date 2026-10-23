import { formatDate } from "../format";
import { Link } from "react-router";
import { projectStatusNames } from "../types";
import type { Project } from "../types";

export function ProjectsTable({ projects }: { projects: Project[] }) {
  return (
    <>
      <p className="table-hint">
        Гортайте таблицю вбік, щоб побачити всі стовпці.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Таблиця проєктів"
        tabIndex={0}
      >
        <table className="projects-table">
          <thead>
            <tr>
              <th scope="col">Проєкт</th>
              <th scope="col">Статус</th>
              <th scope="col">Завдання</th>
              <th scope="col">Дедлайн</th>
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
                    <summary>Опис проєкту</summary>
                    <p>{project.description || "Опис не додано."}</p>
                  </details>
                </td>
                <td>
                  <span className={"project-status status-" + project.status}>
                    {projectStatusNames[project.status]}
                  </span>
                </td>
                <td>
                  <div className="task-count">
                    {project.completedTasks} з {project.totalTasks}
                    <span>{project.progress}%</span>
                  </div>
                  <progress
                    className="project-progress"
                    max={100}
                    value={project.progress}
                    aria-label={"Виконання проєкту " + project.title}
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
                    <span className="muted">Не визначено</span>
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
