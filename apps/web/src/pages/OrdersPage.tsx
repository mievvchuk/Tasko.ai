import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { request, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../useApi";
import { parsePage, formatDate } from "../format";
import { Pagination, ResourceState } from "../components/ResourceState";
import { UserAvatar } from "../components/UserAvatar";
import { orderStatusNames } from "../types";
import type { Project, Order, OrderStatus } from "../types";
import { uiLocale } from "../i18n.en";
import { useLanguage } from "../i18n";

// Замовлення — угоди з виконавцями: з'являються, коли клієнт приймає заявку.
export function OrdersPage() {
  const { tr } = useLanguage();
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
  async function save(orderId: string, status: OrderStatus) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request(`/orders/${orderId}`, {
        method: "PATCH",
        body: { status },
      });
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
    project.data.clientId === user?.id;
  return (
    <>
      <Link className="breadcrumb" to={`/projects/${id}`}>
        {tr("← До проєкту")}
      </Link>
      <div className="page-heading">
        <h1>{tr("Замовлення")}</h1>
        <p>{project.data.title}</p>
      </div>
      <section className="data-panel">
        <div className="panel-heading">
          <h2>{tr("Замовлення проєкту")}</h2>
          <button className="button secondary" onClick={orders.refresh}>
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
            {tr("Оновити")}
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
                <li className="form-note">
                  {tr(
                    "Замовлень ще немає. Замовлення створюється, коли ви приймаєте заявку фрілансера.",
                  )}
                </li>
              )}
              {orders.data.map((order) => (
                <li key={order.id}>
                  <div className="record-heading">
                    {order.freelancer ? (
                      <Link
                        className="admin-user-cell"
                        to={`/freelancers/${order.freelancer.id}`}
                      >
                        <UserAvatar
                          name={order.freelancer.name}
                          avatarUrl={order.freelancer.avatarUrl}
                          size="small"
                        />
                        <strong>{order.freelancer.name}</strong>
                      </Link>
                    ) : (
                      <strong>
                        {tr("Замовлення")} {order.id.slice(0, 8)}
                      </strong>
                    )}
                    <span className="project-status">
                      {tr(orderStatusNames[order.status])}
                    </span>
                  </div>
                  <p className="form-note">
                    {order.amount !== null && (
                      <>
                        {tr("Сума:")} {order.amount.toLocaleString(uiLocale())}{" "}
                        {tr("грн")}
                        {" · "}
                      </>
                    )}
                    {order.deadline && (
                      <>
                        {tr("Строк:")} {formatDate(order.deadline)}
                        {" · "}
                      </>
                    )}
                    {tr("Створено:")} {formatDate(order.createdAt, true)}
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
                            ? tr("Розпочати замовлення")
                            : tr("Завершити замовлення")}
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                tr(
                                  "Скасувати це замовлення? Повернути його в роботу буде неможливо.",
                                ),
                              )
                            )
                              void save(order.id, "CANCELLED");
                          }}
                        >
                          {tr("Скасувати замовлення")}
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
