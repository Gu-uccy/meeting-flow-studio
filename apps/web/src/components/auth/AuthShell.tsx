import { LandingPage } from "./LandingPage";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

type AuthView = "landing" | "login" | "register";

type AuthShellProps = {
  authView: AuthView;
  onAuthViewChange: (view: AuthView) => void;
};

export function AuthLoadingScreen() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <h1>Meeting Flow Studio</h1>
          <p>正在加载...</p>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ authView, onAuthViewChange }: AuthShellProps) {
  if (authView === "login" || authView === "register") {
    const isLoginView = authView === "login";

    return (
      <div className={`auth-switch-stage auth-switch-stage--${authView}`}>
        <div className="auth-background" aria-hidden="true">
          <svg className="auth-background__curve" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <defs>
              <linearGradient id="auth-flow-line" x1="0" x2="1" y1="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="34%" stopColor="#dbeafe" stopOpacity="0.22" />
                <stop offset="76%" stopColor="#7eb0b8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="auth-portal-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
                <stop offset="42%" stopColor="#7eb0b8" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#8fc0c5" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path className="auth-background__plane" d="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z">
              <animate attributeName="d" calcMode="spline" dur="18s" keySplines="0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1" keyTimes="0; 0.28; 0.52; 0.78; 1" repeatCount="indefinite"
                values="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z; M0 92 C22 78 25 54 45 56 C67 58 76 19 100 5 V100 H0 Z; M0 92 C9 86 26 78 38 66 C55 49 77 38 100 5 V100 H0 Z; M0 92 C19 72 31 67 47 51 C63 35 81 31 100 5 V100 H0 Z; M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5 V100 H0 Z" />
            </path>
            <path className="auth-background__boundary" d="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5" pathLength="1">
              <animate attributeName="d" calcMode="spline" dur="18s" keySplines="0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1; 0.45 0 0.25 1" keyTimes="0; 0.28; 0.52; 0.78; 1" repeatCount="indefinite"
                values="M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5; M0 92 C22 78 25 54 45 56 C67 58 76 19 100 5; M0 92 C9 86 26 78 38 66 C55 49 77 38 100 5; M0 92 C19 72 31 67 47 51 C63 35 81 31 100 5; M0 92 C14 82 22 66 40 58 C60 49 77 28 100 5" />
            </path>
            <g className="auth-background__portal" transform="translate(96 9)">
              <circle className="auth-background__portal-glow" r="7" />
              <circle className="auth-background__portal-ring auth-background__portal-ring--outer" r="3.2" />
              <circle className="auth-background__portal-ring auth-background__portal-ring--inner" r="1.7" />
            </g>
          </svg>
        </div>
        <LoginPage
          isActive={isLoginView}
          onBackToLanding={() => onAuthViewChange("landing")}
          onSwitchToRegister={() => onAuthViewChange("register")}
        />
        <RegisterPage
          isActive={!isLoginView}
          onBackToLanding={() => onAuthViewChange("landing")}
          onSwitchToLogin={() => onAuthViewChange("login")}
        />
      </div>
    );
  }

  return (
    <LandingPage
      onLoginClick={() => onAuthViewChange("login")}
      onRegisterClick={() => onAuthViewChange("register")}
    />
  );
}
