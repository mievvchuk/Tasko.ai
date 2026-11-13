import { useRef, useState } from "react";
import { downloadFile, errorMessage, fetchFile, request } from "../api";
import { AdminDialog } from "../pages/AdminSections";
import type { FileAttachment } from "../types";

import { useLanguage } from "../i18n";
export const fileAccept = ".pdf,.png,.jpg,.jpeg,.docx,.zip,.txt";

const megabyte = 1024 * 1024;
// ZIP — архів проєкту, тому йому більший ліміт (так само перевіряє сервер)
const limitFor = (name: string) =>
  extension(name) === "zip" ? 50 * megabyte : 10 * megabyte;

// Файли завантажуються одразу після вибору чи перетягування — без окремої кнопки.
// Кілька файлів ідуть по черзі; помилка одного не зупиняє решту.
export function FileUpload({
  projectId,
  onUploaded,
  onBusyChange,
  disabled = false,
  maxFiles,
}: {
  projectId: string;
  onUploaded: (file: FileAttachment) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  // Скільки ще можна додати (напр. до здачі — до 10 файлів)
  maxFiles?: number;
}) {
  const { tr } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const busy = progress !== null;

  async function uploadAll(list: FileList | null) {
    if (!list?.length || busy || disabled) return;
    const files = [...list].slice(0, maxFiles ?? list.length);
    const problems: string[] = [];
    if (maxFiles !== undefined && list.length > maxFiles)
      problems.push(
        tr("Можна додати ще {0} файл(ів) — решту пропущено.", maxFiles),
      );
    setErrors([]);
    setProgress({ done: 0, total: files.length });
    onBusyChange?.(true);
    for (const [index, file] of files.entries()) {
      if (!file.size || file.size > limitFor(file.name)) {
        problems.push(
          tr(
            "{0}: файл порожній або завеликий (ZIP до 50 МБ, інші до 10 МБ).",
            file.name,
          ),
        );
      } else {
        try {
          const body = new FormData();
          body.append("file", file);
          const saved = await request<FileAttachment>(
            `/projects/${projectId}/files`,
            { method: "POST", body, timeoutMs: 120000 },
          );
          onUploaded(saved);
        } catch (error) {
          problems.push(`${file.name}: ${errorMessage(error)}`);
        }
      }
      setProgress({ done: index + 1, total: files.length });
    }
    if (input.current) input.current.value = "";
    setErrors(problems);
    setProgress(null);
    onBusyChange?.(false);
  }

  return (
    <div className="file-upload-block">
      <label
        className={
          "file-dropzone" +
          (dragging ? " dragging" : "") +
          (busy || disabled ? " disabled" : "")
        }
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy && !disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void uploadAll(event.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept={fileAccept}
          disabled={busy || disabled}
          onChange={(event) => void uploadAll(event.target.files)}
        />
        <i
          className={`bi ${busy ? "bi-arrow-repeat spin" : "bi-cloud-arrow-up"}`}
          aria-hidden="true"
        ></i>
        <strong>
          {busy
            ? tr("Завантажуємо {0} з {1}…", progress.done + 1, progress.total)
            : tr("Перетягніть файли сюди або оберіть на комп'ютері")}
        </strong>
        <small>
          {tr(
            "PDF, PNG, JPG, DOCX, TXT — до 10 МБ, ZIP — до 50 МБ. Можна кілька одразу.",
          )}
        </small>
      </label>
      {errors.length > 0 && (
        <ul className="notice error file-errors" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Що браузер може показати сам: PDF і картинки — як є, TXT — текстом. DOCX і ZIP лише завантажуються.
const previewTypes: Record<string, "pdf" | "image" | "text"> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  txt: "text",
};
const mimeTypes = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
} as Record<string, string>;
function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

type Preview =
  { kind: "pdf" | "image"; url: string } | { kind: "text"; text: string };

// Тип файлу → значок і колір плитки
function fileKind(ext: string) {
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg"].includes(ext)) return "image";
  if (ext === "docx") return "doc";
  if (ext === "zip") return "zip";
  return "text";
}
const fileIcons: Record<string, string> = {
  pdf: "bi-file-earmark-pdf",
  image: "bi-file-earmark-image",
  doc: "bi-file-earmark-word",
  zip: "bi-file-earmark-zip",
  text: "bi-file-earmark-text",
};

export function FileDownload({
  file,
  onRemove,
  removeLabel,
}: {
  file: FileAttachment;
  // Кнопка «прибрати» (напр. файл не йде в результат або власний файл видаляється)
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const { tr } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const ext = extension(file.fileName);
  const kind = previewTypes[ext];
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const open = () =>
    run(async () => {
      const blob = await fetchFile(file.id);
      if (kind === "text") setPreview({ kind, text: await blob.text() });
      else
        setPreview({
          kind,
          // Тип за розширенням, щоб браузер точно показав PDF/картинку, а не завантажив
          url: URL.createObjectURL(new Blob([blob], { type: mimeTypes[ext] })),
        });
    });
  function close() {
    if (preview && preview.kind !== "text") URL.revokeObjectURL(preview.url);
    setPreview(null);
  }
  const size =
    file.size >= megabyte
      ? tr("{0} МБ", (file.size / megabyte).toFixed(1))
      : tr("{0} КБ", Math.max(1, Math.ceil(file.size / 1024)));
  return (
    <div className="file-item">
      <span className={`file-type type-${fileKind(ext)}`} aria-hidden="true">
        <i className={`bi ${fileIcons[fileKind(ext)]}`}></i>
      </span>
      <span className="file-meta">
        <button
          className="file-name"
          type="button"
          disabled={busy}
          title={file.fileName}
          onClick={() =>
            void (kind
              ? open()
              : run(() => downloadFile(file.id, file.fileName)))
          }
        >
          {busy ? tr("Отримуємо файл…") : file.fileName}
        </button>
        <small>
          {ext.toUpperCase()} · {size}
        </small>
      </span>
      <span className="file-actions">
        {kind && (
          <button
            className="icon-action"
            type="button"
            disabled={busy}
            aria-label={tr("Переглянути {0}", file.fileName)}
            title={tr("Переглянути")}
            onClick={() => void open()}
          >
            <i className="bi bi-eye" aria-hidden="true"></i>
          </button>
        )}
        <button
          className="icon-action"
          type="button"
          disabled={busy}
          aria-label={tr("Завантажити {0}", file.fileName)}
          title={tr("Завантажити")}
          onClick={() => void run(() => downloadFile(file.id, file.fileName))}
        >
          <i className="bi bi-download" aria-hidden="true"></i>
        </button>
        {onRemove && (
          <button
            className="icon-action danger"
            type="button"
            disabled={busy}
            aria-label={tr("Прибрати {0}", file.fileName)}
            title={removeLabel ?? tr("Видалити")}
            onClick={onRemove}
          >
            <i className="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        )}
      </span>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <AdminDialog title={file.fileName} onClose={close}>
          <div className="file-preview">
            {preview.kind === "pdf" && (
              <iframe src={preview.url} title={file.fileName}></iframe>
            )}
            {preview.kind === "image" && (
              <img src={preview.url} alt={file.fileName} />
            )}
            {preview.kind === "text" && <pre>{preview.text}</pre>}
          </div>
          <div className="admin-dialog-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => void downloadFile(file.id, file.fileName)}
            >
              <i className="bi bi-download" aria-hidden="true"></i>
              {tr("Завантажити")}
            </button>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
