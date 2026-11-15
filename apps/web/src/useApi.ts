import { useCallback, useEffect, useState } from "react";
import { errorMessage, request } from "./api";
import { useLiveRefresh } from "./useLiveRefresh";

// live: перечитувати дані, коли на сервері щось змінилось (див. useLiveRefresh).
// Таке перечитування тихе: попередні дані лишаються на екрані, доки не прийдуть нові.
export function useApi<T>(path: string | null, options?: { live?: boolean }) {
  const [version, setVersion] = useState({ count: 0, silent: false });
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path: null, data: null, error: "", loading: false });
  const refresh = useCallback(
    () => setVersion((value) => ({ count: value.count + 1, silent: false })),
    [],
  );
  const reload = useCallback(
    () => setVersion((value) => ({ count: value.count + 1, silent: true })),
    [],
  );
  useLiveRefresh(reload, Boolean(options?.live && path));
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, error: "", loading: false });
      return;
    }
    const controller = new AbortController();
    let active = true;
    const silent = version.silent;
    setState((previous) =>
      silent && previous.path === path && previous.data !== null
        ? previous
        : { path, data: null, error: "", loading: true },
    );
    void request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (active) setState({ path, data, error: "", loading: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        // Невдале тихе оновлення не прибирає з екрана вже показані дані
        setState((previous) =>
          silent && previous.path === path && previous.data !== null
            ? previous
            : { path, data: null, error: errorMessage(error), loading: false },
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, version]);
  if (state.path !== path)
    return { data: null, error: "", loading: Boolean(path), refresh };
  return { ...state, refresh };
}
