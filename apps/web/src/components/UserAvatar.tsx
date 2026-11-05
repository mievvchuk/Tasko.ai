import { useState } from "react";
import { apiUrl } from "../api";

// Аватар: фото профілю, а якщо його немає (або не завантажилось) — перша літера імені
export function UserAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "small" | "large" | "xl";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const className = size ? `avatar ${size}` : "avatar";
  if (avatarUrl && failed !== avatarUrl)
    return (
      <img
        className={`${className} photo`}
        src={apiUrl(avatarUrl)}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(avatarUrl)}
      />
    );
  return (
    <span className={className} aria-hidden="true">
      {/* Перша літера чи цифра: charAt(0) ламає емодзі на половинку символу */}
      {(name.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase()}
    </span>
  );
}
