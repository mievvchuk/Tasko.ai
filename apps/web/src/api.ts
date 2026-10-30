import { trNow } from "./i18n.en.ts";
export const tokenKey = "tasko.accessToken";
export const sessionEndedEvent = "tasko:session-ended";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  responseType?: "blob";
  timeoutMs?: number;
}

// Повна адреса ресурсу API (напр. фото профілю для тегу <img>)
export function apiUrl(path: string) {
  const baseUrl = import.meta.env?.VITE_API_URL || "/api";
  return baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
}

export function getToken() {
  return sessionStorage.getItem(tokenKey);
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return trNow("Не вдалося виконати дію. Спробуйте ще раз.");
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = import.meta.env?.VITE_API_URL || "/api";
  const headers = new Headers({ Accept: "application/json" });
  const authenticated = options.auth !== false;
  if (authenticated) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const formData = options.body instanceof FormData;
  if (options.body !== undefined && !formData) {
    headers.set("Content-Type", "application/json");
  }
  let body: string | FormData | undefined;
  if (options.body !== undefined) {
    if (formData) body = options.body as FormData;
    else body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(
      baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, ""),
      {
        method: options.method || "GET",
        headers,
        body,
        signal: AbortSignal.any([
          AbortSignal.timeout(options.timeoutMs || 15000),
          ...(options.signal ? [options.signal] : []),
        ]),
      },
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      trNow(
        "Сервер недоступний або не відповідає. Перевірте з’єднання та спробуйте ще раз.",
      ),
    );
  }

  if (response.ok && options.responseType === "blob")
    return (await response.blob()) as T;
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(
      response.ok ? 502 : response.status,
      trNow("Сервер повернув некоректну відповідь. Спробуйте пізніше."),
    );
  }

  if (!response.ok) {
    let message = trNow("Не вдалося виконати запит. Спробуйте пізніше.");
    if (response.status === 400)
      message = trNow("Перевірте введені дані та спробуйте ще раз.");
    if (response.status === 401)
      message = trNow("Потрібно увійти до облікового запису.");
    if (response.status === 403)
      message = trNow("У вас немає доступу до цієї дії.");
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof data.message === "string" &&
      /[А-Яа-яІіЇїЄєҐґ]/.test(data.message)
    ) {
      message = trNow(data.message);
    }
    if (
      authenticated &&
      (response.status === 401 ||
        (response.status === 403 && message.includes("заблоковано")))
    ) {
      window.dispatchEvent(new Event(sessionEndedEvent));
    }
    throw new ApiError(response.status, message);
  }

  return data as T;
}

export async function downloadFile(id: string, fileName: string) {
  const blob = await request<Blob>(`/files/${id}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadApiFile(path: string, fileName: string) {
  const blob = await request<Blob>(path, { responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
