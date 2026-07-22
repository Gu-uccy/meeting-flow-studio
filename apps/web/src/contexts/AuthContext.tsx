import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { PublicUser, UserRole } from "@meeting-flow/shared";
import { apiClient, readJson } from "../lib/apiClient";

type AuthState = {
  user: PublicUser | null;
  token: string | null;
  isLoading: boolean;
  error: string;
  effectiveRole: UserRole | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  switchWorkspace: (workspaceId: string) => Promise<boolean>;
  applySession: (user: PublicUser, token: string) => void;
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

function resolveEffectiveRole(user: PublicUser | null, explicit?: UserRole): UserRole | null {
  if (!user) return null;
  return explicit ?? user.effectiveRole ?? user.role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [effectiveRole, setEffectiveRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    void apiClient("/api/auth/me")
      .then(async (response) => {
        if (response.ok) {
          const data = (await readJson(response)) as { user: PublicUser; effectiveRole?: UserRole };
          setUser(data.user);
          setEffectiveRole(resolveEffectiveRole(data.user, data.effectiveRole));
          setStoredToken(storedToken);
          return;
        }

        if (response.status === 401) {
          setStoredToken(null);
          setToken(null);
          setEffectiveRole(null);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError("");

    try {
      const response = await apiClient("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      const data = (await readJson(response)) as {
        user: PublicUser;
        token: string;
        effectiveRole?: UserRole;
      };

      if (!response.ok || !data.user || !data.token) {
        throw new Error((data as { message?: string }).message ?? "登录失败");
      }

      setUser(data.user);
      setToken(data.token);
      setEffectiveRole(resolveEffectiveRole(data.user, data.effectiveRole));
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
      const data = (await readJson(response)) as {
        user: PublicUser;
        token: string;
        effectiveRole?: UserRole;
      };

      if (!response.ok || !data.user || !data.token) {
        throw new Error((data as { message?: string }).message ?? "注册失败");
      }

      setUser(data.user);
      setToken(data.token);
      setEffectiveRole(resolveEffectiveRole(data.user, data.effectiveRole));
      setStoredToken(data.token);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "注册失败");
      return false;
    }
  }, []);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    setError("");

    try {
      const response = await apiClient("/api/auth/me/workspace", {
        method: "PATCH",
        body: JSON.stringify({ workspaceId })
      });
      const data = (await readJson(response)) as {
        user: PublicUser;
        token: string;
        effectiveRole?: UserRole;
        message?: string;
      };

      if (!response.ok || !data.user || !data.token) {
        throw new Error(data.message ?? "切换工作区失败");
      }

      setUser(data.user);
      setToken(data.token);
      setEffectiveRole(resolveEffectiveRole(data.user, data.effectiveRole));
      setStoredToken(data.token);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "切换工作区失败");
      return false;
    }
  }, []);

  const applySession = useCallback((nextUser: PublicUser, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    setEffectiveRole(resolveEffectiveRole(nextUser));
    setStoredToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setEffectiveRole(null);
    setStoredToken(null);
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      error,
      effectiveRole,
      login,
      register,
      switchWorkspace,
      applySession,
      logout,
      clearError
    }),
    [user, token, isLoading, error, effectiveRole, login, register, switchWorkspace, applySession, logout, clearError]
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
