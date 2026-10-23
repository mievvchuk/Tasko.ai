import { useState } from "react";
import type { FormEvent } from "react";
import { errorMessage, request } from "../api";

export function ReviewForm({
  projectId,
  freelancerId,
  freelancerName,
}: {
  projectId: string;
  freelancerId: string;
  freelancerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await request(`/projects/${projectId}/reviews`, {
        method: "POST",
        body: { freelancerId, rating: Number(rating), comment },
      });
      setSaved(true);
      setOpen(false);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) return <span className="success-text">Відгук збережено</span>;
  if (!open)
    return (
      <button className="link-button" onClick={() => setOpen(true)}>
        Залишити відгук
      </button>
    );
  return (
    <form className="review-form" onSubmit={(event) => void submit(event)}>
      <strong>Відгук про {freelancerName}</strong>
      <label>
        Оцінка
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          <option value="5">5 — Відмінно</option>
          <option value="4">4 — Добре</option>
          <option value="3">3 — Задовільно</option>
          <option value="2">2 — Погано</option>
          <option value="1">1 — Дуже погано</option>
        </select>
      </label>
      <label>
        Коментар
        <textarea
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="page-actions">
        <button className="button primary" disabled={submitting}>
          {submitting ? "Зберігаємо…" : "Зберегти"}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setOpen(false)}
        >
          Скасувати
        </button>
      </div>
    </form>
  );
}
