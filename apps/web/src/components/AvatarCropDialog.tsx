import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { cropFrame } from "../format";
import { useLanguage } from "../i18n";
import { AdminDialog } from "../pages/AdminSections";

const frame = 280; // розмір рамки в CSS-пікселях
const outputSize = 512; // розмір збереженого фото

// Обрізання фото під кругле: тягнути — зсунути, повзунок — наблизити. Без сторонніх бібліотек, лише canvas.
export function AvatarCropDialog({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  onSave: (cropped: File) => void;
}) {
  const { tr } = useLanguage();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Початково — по центру
      const view = cropFrame(img, frame, 1, { x: -Infinity, y: -Infinity });
      setOffset({
        x: (frame - img.width * view.scale) / 2,
        y: (frame - img.height * view.scale) / 2,
      });
      setImage(img);
    };
    img.onerror = () => setFailed(true);
    img.src = url;
    return () => {
      // Відкликана адреса інакше викликала б onerror у вже непотрібного зображення
      img.onload = img.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const view = image ? cropFrame(image, frame, zoom, offset) : null;

  // Наближення тримає на місці центр рамки
  function changeZoom(next: number) {
    if (!image || !view) return;
    const centre = {
      x: (frame / 2 - view.x) / view.scale,
      y: (frame / 2 - view.y) / view.scale,
    };
    const scale = (frame / Math.min(image.width, image.height)) * next;
    setZoom(next);
    setOffset({ x: frame / 2 - centre.x * scale, y: frame / 2 - centre.y * scale });
  }
  function move(dx: number, dy: number) {
    if (!view) return;
    setOffset({ x: view.x + dx, y: view.y + dy });
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    move(event.clientX - drag.current.x, event.clientY - drag.current.y);
    drag.current = { x: event.clientX, y: event.clientY };
  }
  function keyMove(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [10, 0],
      ArrowRight: [-10, 0],
      ArrowUp: [0, 10],
      ArrowDown: [0, -10],
    };
    if (!steps[event.key]) return;
    event.preventDefault();
    move(...steps[event.key]);
  }
  function save() {
    if (!image || !view) return;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const { source } = view;
    canvas
      .getContext("2d")
      ?.drawImage(image, source.x, source.y, source.size, source.size, 0, 0, outputSize, outputSize);
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <AdminDialog
      title={tr("Фото профілю")}
      description={tr("Перетягніть фото й наблизьте його, щоб обличчя було в колі.")}
      onClose={onCancel}
    >
      {failed && (
        <p className="notice error" role="alert">
          {tr("Не вдалося відкрити зображення. Оберіть інший файл.")}
        </p>
      )}
      {image && view && (
        <div className="avatar-crop">
          <div
            className="avatar-crop-stage"
            style={{ width: frame, height: frame }}
            role="img"
            tabIndex={0}
            aria-label={tr("Область фото. Стрілки зсувають зображення.")}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={keyMove}
          >
            <img
              src={image.src}
              alt=""
              draggable={false}
              style={{
                width: image.width * view.scale,
                height: image.height * view.scale,
                transform: `translate(${view.x}px, ${view.y}px)`,
              }}
            />
          </div>
          <label className="avatar-crop-zoom">
            <i className="bi bi-zoom-out" aria-hidden="true"></i>
            <span className="visually-hidden">{tr("Масштаб")}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(event) => changeZoom(Number(event.target.value))}
            />
            <i className="bi bi-zoom-in" aria-hidden="true"></i>
          </label>
        </div>
      )}
      <div className="admin-dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          {tr("Скасувати")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!image}
          onClick={save}
        >
          {tr("Зберегти фото")}
        </button>
      </div>
    </AdminDialog>
  );
}
