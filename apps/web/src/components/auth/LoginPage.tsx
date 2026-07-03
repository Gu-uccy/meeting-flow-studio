import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { BrandMark } from "../common/BrandMark";

type AuthPageProps = {
  isActive?: boolean;
  onBackToLanding: () => void;
  onSwitchToRegister: () => void;
};

export function LoginPage({ isActive = true, onBackToLanding, onSwitchToRegister }: AuthPageProps) {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      await login(email, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToLanding() {
    clearError();
    onBackToLanding();
  }

  function handleSwitchToRegister() {
    clearError();
    onSwitchToRegister();
  }

  return (
    <div
      aria-hidden={!isActive}
      className={`auth-page auth-page--dedicated auth-page--login ${isActive ? "auth-page--active" : "auth-page--inactive"}`}
    >
      <button className="text-button auth-back-button" onClick={handleBackToLanding} type="button">
        返回介绍页
      </button>

      <div className="auth-card auth-card--standalone">
        <div className="auth-card__brand">
          <BrandMark />
          <span>Meeting Flow Studio</span>
        </div>
        <div className="auth-card__header">
          <h1>登录</h1>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <label>
            <span>邮箱</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@meetingflow.local"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>密码</span>
            <input
              autoComplete="current-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin123"
              required
              type="password"
              value={password}
            />
          </label>

          <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="auth-card__footer">
          <span>还没有账号？</span>
          <button className="text-button" onClick={handleSwitchToRegister} type="button">
            注册
          </button>
        </div>
      </div>
    </div>
  );
}
