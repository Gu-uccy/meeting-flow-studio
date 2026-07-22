import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate
} from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import { WorkbenchProvider } from "./contexts/WorkbenchContext";
import { AuthLoadingScreen, AuthShell } from "./components/auth/AuthShell";
import { WorkbenchShell } from "./components/workbench/WorkbenchShell";
import { buildWorkbenchPath, parseWorkbenchPath } from "./lib/workbenchRouting";
import { getDefaultWorkbenchView, getProductRole } from "./components/workbench/layout/navAccess";

function AuthRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authView, setAuthView] = useState<"landing" | "login" | "register">(() => {
    if (location.pathname.startsWith("/login")) return "login";
    if (location.pathname.startsWith("/register")) return "register";
    return "landing";
  });

  useEffect(() => {
    if (location.pathname.startsWith("/login")) {
      setAuthView("login");
    } else if (location.pathname.startsWith("/register")) {
      setAuthView("register");
    } else if (location.pathname === "/" || location.pathname === "") {
      setAuthView("landing");
    }
  }, [location.pathname]);

  if (user) {
    const redirect = (location.state as { from?: string } | null)?.from;
    if (redirect && redirect.startsWith("/app")) {
      return <Navigate replace to={redirect} />;
    }
    return <Navigate replace to={buildWorkbenchPath(getDefaultWorkbenchView(getProductRole(user)))} />;
  }

  return (
    <AuthShell
      authView={authView}
      onAuthViewChange={(view) => {
        setAuthView(view);
        if (view === "landing") {
          navigate("/", { replace: true });
        } else {
          navigate(`/${view}`, { replace: true });
        }
      }}
    />
  );
}

function ProtectedWorkbench() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    const route = parseWorkbenchPath(location.pathname);
    if (!route) {
      navigate(buildWorkbenchPath(getDefaultWorkbenchView(getProductRole(user))), { replace: true });
    }
  }, [isLoading, location.pathname, navigate, user]);

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return (
    <WorkbenchProvider>
      <WorkbenchShell
        onLogout={() => {
          logout();
          navigate("/", { replace: true });
        }}
      />
    </WorkbenchProvider>
  );
}

export default function App() {
  const { isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Routes>
      <Route element={<AuthRoutes />} path="/" />
      <Route element={<AuthRoutes />} path="/login" />
      <Route element={<AuthRoutes />} path="/register" />
      <Route element={<ProtectedWorkbench />} path="/app" />
      <Route element={<ProtectedWorkbench />} path="/app/:view" />
      <Route element={<ProtectedWorkbench />} path="/app/:view/:resourceId" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
