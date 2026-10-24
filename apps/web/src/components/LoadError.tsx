export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="load-error" role="alert">
      <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
      <div>
        <strong>Не вдалося завантажити дані</strong>
        <p>{message}</p>
      </div>
      <button className="button secondary" onClick={onRetry}>
        <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
        Спробувати ще раз
      </button>
    </div>
  );
}
