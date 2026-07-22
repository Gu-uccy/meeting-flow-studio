import { useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import { WorkbenchProvider } from "./contexts/WorkbenchContext";
import { AuthLoadingScreen, AuthShell } from "./components/auth/AuthShell";
import { WorkbenchShell } from "./components/workbench/WorkbenchShell";

export default function App() {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const [authView, setAuthView] = useState<"landing" | "login" | "register">("landing");

  function handleLogout() {
    setAuthView("landing");
    logout();
  }

  if (isAuthLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <AuthShell authView={authView} onAuthViewChange={setAuthView} />;
  }

  return (
    <WorkbenchProvider>
      <WorkbenchShell onLogout={handleLogout} />
    </WorkbenchProvider>
  );
}
