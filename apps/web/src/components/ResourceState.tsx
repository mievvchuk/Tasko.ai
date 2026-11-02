import { LoadError } from "./LoadError";

import { useLanguage } from "../i18n";
export function ResourceState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const { tr } = useLanguage();
  if (loading)
    return (
      <div className="page-loading" role="status">
        <span className="loader" />

        {tr("Завантажуємо дані…")}
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
  const { tr } = useLanguage();
  return (
    <nav className="pagination" aria-label={tr("Сторінки списку")}>
      <span>
        {tr("Сторінка")} {page} {tr("· Показано:")} {count}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          {tr("← Попередня")}
        </button>
        <button
          className="button secondary"
          disabled={count < size || page === 10000}
          onClick={() => onChange(page + 1)}
        >
          {tr("Наступна →")}
        </button>
      </div>
    </nav>
  );
}
