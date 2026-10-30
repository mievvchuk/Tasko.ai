import { useLanguage } from "../i18n";
export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { tr } = useLanguage();
  return (
    <div className="load-error" role="alert">
      <i className="bi bi-exclamation-triangle" aria-hidden="true"></i>
      <div>
        <strong>{tr("Не вдалося завантажити дані")}</strong>
        <p>{message}</p>
      </div>
      <button className="button secondary" onClick={onRetry}>
        <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>

        {tr("Спробувати ще раз")}
      </button>
    </div>
  );
}
