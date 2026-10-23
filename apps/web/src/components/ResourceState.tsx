import { LoadError } from "./LoadError";

export function ResourceState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <div className="page-loading" role="status">
        <span className="loader" />
        Завантажуємо дані…
      </div>
    );
  if (error) return <LoadError message={error} onRetry={onRetry} />;
  return null;
}

export function Pagination({
  page,
  count,
  onChange,
  size = 20,
}: {
  page: number;
  count: number;
  size?: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Сторінки списку">
      <span>
        Сторінка {page} · Показано: {count}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          ← Попередня
        </button>
        <button
          className="button secondary"
          disabled={count < size || page === 10000}
          onClick={() => onChange(page + 1)}
        >
          Наступна →
        </button>
      </div>
    </nav>
  );
}
