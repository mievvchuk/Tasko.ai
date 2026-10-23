import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage, formatDate } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { orderStatusNames } from "../types";
import type { Project, Order, OrderStatus } from "../types";

export function OrdersPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get("page"));
  const project = useApi<Project>(`/projects/${id}`);
  const orders = useApi<Order[]>(
    project.data ? `/projects/${id}/orders?page=${page}&limit=20` : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(orderId?: string, status?: OrderStatus) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(orderId ? `/orders/${orderId}` : `/projects/${id}/orders`, {
        method: orderId ? "PATCH" : "POST",
        ...(status ? { body: { status } } : {}),
      });
      if (!orderId) setParams({});
      orders.refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (!project.data)
    return (
      <ResourceState
        loading={project.loading}
        error={project.error}
        onRetry={project.refresh}
      />
    );
  const canManage =
    !["COMPLETED", "CANCELLED"].includes(project.data.status) &&
    (user?.role === "ADMIN" || project.data.clientId === user?.id);
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        ← До проєкту
      </Link>
      <div className="page-heading heading-with-action">
        <div>
          <h1>Замовлення</h1>
          <p>{project.data.title}</p>
        </div>
        {canManage && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              void save();
            }}
          >
            Створити замовлення
          </button>
        )}
      </div>
      <section className="data-panel">
        <div className="panel-heading">
          <h2>Замовлення проєкту</h2>
          <button className="button secondary" onClick={orders.refresh}>
            Оновити
          </button>
        </div>
        {error && (
          <p className="notice error padded" role="alert">
            {error}
          </p>
        )}
        <ResourceState
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.refresh}
        />
        {orders.data && (
          <>
            <ul className="record-list padded">
              {!orders.data.length && (
                <li className="form-note">На цій сторінці замовлень немає.</li>
              )}
              {orders.data.map((order) => (
                <li key={order.id}>
                  <div className="record-heading">
                    <strong>Замовлення {order.id.slice(0, 8)}</strong>
                    <span className="project-status">
                      {orderStatusNames[order.status]}
                    </span>
                  </div>
                  <p className="form-note">
                    Створено: {formatDate(order.createdAt, true)} · Оновлено:{" "}
                    {formatDate(order.updatedAt, true)}
                  </p>
                  {canManage &&
                    ["PENDING", "IN_PROGRESS"].includes(order.status) && (
                      <div className="page-actions">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            void save(
                              order.id,
                              order.status === "PENDING"
                                ? "IN_PROGRESS"
                                : "COMPLETED",
                            );
                          }}
                        >
                          {order.status === "PENDING"
                            ? "Розпочати замовлення"
                            : "Завершити замовлення"}
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Скасувати це замовлення? Повернути його в роботу буде неможливо.",
                              )
                            )
                              void save(order.id, "CANCELLED");
                          }}
                        >
                          Скасувати замовлення
                        </button>
                      </div>
                    )}
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              count={orders.data.length}
              onChange={(value) => setParams({ page: String(value) })}
            />
          </>
        )}
      </section>
    </>
  );
}
