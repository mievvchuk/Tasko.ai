import { useRef, useState } from "react";
import { downloadFile, errorMessage, fetchFile, request } from "../api";
import { AdminDialog } from "../pages/AdminSections";
import type { FileAttachment } from "../types";

import { useLanguage } from "../i18n";
export const fileAccept = ".pdf,.png,.jpg,.jpeg,.docx,.zip,.txt";

export function FileUpload({
  projectId,
  onUploaded,
  onBusyChange,
  disabled = false,
}: {
  projectId: string;
  onUploaded: (file: FileAttachment) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { tr } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload() {
    if (!file || busy || disabled) return;
    setError("");
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError(tr("Файл має бути непорожнім і не перевищувати 10 МБ."));
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const saved = await request<FileAttachment>(
        `/projects/${projectId}/files`,
        { method: "POST", body, timeoutMs: 60000 },
      );
      setFile(null);
      if (input.current) input.current.value = "";
      onUploaded(saved);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="work-form file-upload">
      <label htmlFor="upload-file">{tr("Файл для завантаження")}</label>
      <input
        ref={input}
        id="upload-file"
        type="file"
        accept={fileAccept}
        disabled={busy || disabled}
        onChange={(event) => {
          setFile(event.target.files?.[0] || null);
          setError("");
        }}
      />
      <p className="form-note">
        {tr("PDF, PNG, JPG, DOCX, ZIP або TXT (UTF-8), до 10 МБ.")}
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={!file || busy || disabled}
        onClick={() => {
          void upload();
        }}
      >
        <i className="bi bi-upload" aria-hidden="true"></i>
        {busy ? tr("Завантажуємо…") : tr("Завантажити файл")}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
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

type Preview = { kind: "pdf" | "image"; url: string } | { kind: "text"; text: string };

export function FileDownload({ file }: { file: FileAttachment }) {
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
  return (
    <div className="file-item">
      <button
        className="text-button"
        disabled={busy}
        onClick={() =>
          void (kind ? open() : run(() => downloadFile(file.id, file.fileName)))
        }
      >
        <i
          className={`bi ${kind ? "bi-eye" : "bi-download"}`}
          aria-hidden="true"
        ></i>
        {busy ? tr("Отримуємо файл…") : file.fileName}
      </button>
      <small>
        {Math.ceil(file.size / 1024)} {tr("КБ")}
      </small>
      {kind && (
        <button
          className="button ghost file-download"
          type="button"
          disabled={busy}
          aria-label={tr("Завантажити {0}", file.fileName)}
          title={tr("Завантажити")}
          onClick={() => void run(() => downloadFile(file.id, file.fileName))}
        >
          <i className="bi bi-download" aria-hidden="true"></i>
        </button>
      )}
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
