import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { PublicUser } from "@meeting-flow/shared";
import { apiClient } from "../lib/apiClient";

type AuthState = {
  user: PublicUser | null;
  token: string | null;
  isLoading: boolean;
  error: string;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "meeting_flow_token";

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Validate token on mount
  useEffect(() => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    void apiClient("/api/auth/me")
      .then(async (response) => {
        if (response.ok) {
          const data = (await response.json()) as { user: PublicUser };
          setUser(data.user);
          setStoredToken(storedToken);
        } else {
          setStoredToken(null);
          setToken(null);
        }
      })
      .catch(() => {
        setStoredToken(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError("");

    try {
      const response = await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      const data = (await response.json()) as { user: PublicUser; token: string };

      if (!response.ok || !data.user || !data.token) {
        throw new Error((data as { message?: string }).message ?? "登录失败");
      }

      setUser(data.user);
      setToken(data.token);
      setStoredToken(data.token);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "登录失败");
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError("");

    try {
      const response = await apiClient("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name })
      });
      const data = (await response.json()) as { user: PublicUser; token: string };

      if (!response.ok || !data.user || !data.token) {
        throw new Error((data as { message?: string }).message ?? "注册失败");
      }

      setUser(data.user);
      setToken(data.token);
      setStoredToken(data.token);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "注册失败");
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setStoredToken(null);
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, error, login, register, logout, clearError }),
    [user, token, isLoading, error, login, register, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
