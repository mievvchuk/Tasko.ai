export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="load-error" role="alert">
      <div>
        <strong>Не вдалося завантажити дані</strong>
        <p>{message}</p>
      </div>
      <button className="button secondary" onClick={onRetry}>
        Спробувати ще раз
      </button>
    </div>
  );
}
