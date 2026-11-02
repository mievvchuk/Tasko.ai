import { useCallback, useEffect, useState } from "react";
import { errorMessage, request } from "./api";

export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ path: null, data: null, error: "", loading: false });
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, error: "", loading: false });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ path, data: null, error: "", loading: true });
    void request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (active) setState({ path, data, error: "", loading: false });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            path,
            data: null,
            error: errorMessage(error),
            loading: false,
          });
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
