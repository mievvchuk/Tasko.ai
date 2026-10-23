import { useState } from "react";
import { Link, useParams } from "react-router";
import { errorMessage, request } from "../api";
import { ResourceState } from "../components/ResourceState";
import { groupTasksByStatus, kanbanStatuses } from "../kanban";
import { taskStatusNames, type Task, type TaskStatus } from "../types";
import { useApi } from "../useApi";

export function ProjectBoardPage() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<Task[]>(
    id ? `/projects/${id}/tasks?limit=50` : null,
  );
  const [actionError, setActionError] = useState("");
  async function change(taskId: string, status: TaskStatus) {
    setActionError("");
    try {
      await request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: { status },
      });
      refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }
  const groups = groupTasksByStatus(data ?? []);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading">
        <span className="eyebrow">TASKO.AI / KANBAN</span>
        <h1>Дошка завдань</h1>
        <p>Завдання згруповані за поточним статусом.</p>
      </div>
      {actionError && <p className="form-error">{actionError}</p>}
      <ResourceState loading={loading} error={error} onRetry={refresh} />
      {!loading && !error && (
        <div className="kanban-board">
          {kanbanStatuses.map((status) => (
            <section className="kanban-column" key={status}>
              <h2>
                {taskStatusNames[status]} <span>{groups[status].length}</span>
              </h2>
              {groups[status].map((task) => (
                <article className="kanban-card" key={task.id}>
                  <Link to={`/tasks/${task.id}`}>
                    <strong>{task.title}</strong>
                  </Link>
                  <small>{task.description || "Без опису"}</small>
                  {["TODO", "IN_PROGRESS"].includes(task.status) && (
                    <select
                      aria-label={`Статус ${task.title}`}
                      value={task.status}
                      onChange={(e) =>
                        void change(task.id, e.target.value as TaskStatus)
                      }
                    >
                      <option value="TODO">До виконання</option>
                      <option value="IN_PROGRESS">У процесі</option>
                    </select>
                  )}
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
