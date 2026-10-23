import { useRef, useState } from "react";
import { downloadFile, errorMessage, request } from "../api";
import type { FileAttachment } from "../types";

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
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload() {
    if (!file || busy || disabled) return;
    setError("");
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError("Файл має бути непорожнім і не перевищувати 10 МБ.");
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
      <label htmlFor="upload-file">Файл для завантаження</label>
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
        PDF, PNG, JPG, DOCX, ZIP або TXT (UTF-8), до 10 МБ.
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={!file || busy || disabled}
        onClick={() => {
          void upload();
        }}
      >
        {busy ? "Завантажуємо…" : "Завантажити файл"}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function FileDownload({ file }: { file: FileAttachment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await downloadFile(file.id, file.fileName);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="file-item">
      <button
        className="text-button"
        disabled={busy}
        onClick={() => {
          void download();
        }}
      >
        {busy ? "Отримуємо файл…" : file.fileName}
      </button>
      <small>{Math.ceil(file.size / 1024)} КБ</small>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
