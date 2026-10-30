import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ApiError,
  errorMessage,
  getToken,
  request,
  sessionEndedEvent,
  tokenKey,
} from "./api";
import type { LoginResponse, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  connectionError: string;
  notice: string;
  login: (email: string, password: string, code?: string) => Promise<boolean>;
  logout: () => void;
  retry: () => void;
  // Оновлює дані користувача після зміни імені чи фото на сторінці профілю
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);

  function logout() {
    if (getToken()) {
      void request("/auth/logout", { method: "POST" }).catch(() => undefined);
    }
    try {
      sessionStorage.removeItem(tokenKey);
    } catch {
      setNotice(
        "Доступ до сховища браузера обмежено. Закрийте цю вкладку, щоб завершити сеанс.",
      );
    }
    setUser(null);
    setLoading(false);
    setConnectionError("");
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function restore() {
      setLoading(true);
      setConnectionError("");
      try {
        if (!getToken()) return;
        const currentUser = await request<User>("/auth/me", {
          signal: controller.signal,
        });
        if (active) setUser(currentUser);
      } catch (error) {
        if (!active) return;
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          logout();
          setNotice(
            "Сеанс завершено або обліковий запис недоступний. Увійдіть ще раз.",
          );
        } else {
          setConnectionError(errorMessage(error));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void restore();
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    function endSession() {
      logout();
      setNotice(
        "Сеанс завершено або обліковий запис недоступний. Увійдіть ще раз.",
      );
    }
    window.addEventListener(sessionEndedEvent, endSession);
    return () => window.removeEventListener(sessionEndedEvent, endSession);
  }, []);

  async function login(email: string, password: string, code?: string) {
    const response = await request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password, twoFactorCode: code || undefined },
      auth: false,
    });
    if (response.requiresTwoFactor) return false;
    if (!response.accessToken || !response.user) {
      throw new ApiError(502, "Сервер не повернув дані для входу.");
    }
    try {
      sessionStorage.setItem(tokenKey, response.accessToken);
    } catch {
      throw new ApiError(
        0,
        "Дозвольте збереження даних для цього сайту в налаштуваннях браузера.",
      );
    }
    setNotice("");
    setUser(response.user);
    return true;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        connectionError,
        notice,
        login,
        logout,
        retry: () => setAttempt((value) => value + 1),
        updateUser: setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is missing.");
  return context;
}
