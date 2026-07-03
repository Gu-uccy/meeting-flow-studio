import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { BrandMark } from "../common/BrandMark";

type AuthPageProps = {
  isActive?: boolean;
  onBackToLanding: () => void;
  onSwitchToLogin: () => void;
};

export function RegisterPage({ isActive = true, onBackToLanding, onSwitchToLogin }: AuthPageProps) {
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      await register(email, password, name);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToLanding() {
    clearError();
    onBackToLanding();
  }

  function handleSwitchToLogin() {
    clearError();
    onSwitchToLogin();
  }

  return (
    <div
      aria-hidden={!isActive}
      className={`auth-page auth-page--dedicated auth-page--register ${isActive ? "auth-page--active" : "auth-page--inactive"}`}
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
          <h1>创建账号</h1>
          <p>保存你的会议流程、模板配置和运行记录。</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <label>
            <span>姓名</span>
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="你的姓名"
              required
              type="text"
              value={name}
            />
          </label>

          <label>
            <span>邮箱</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>密码</span>
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位"
              required
              type="password"
              value={password}
            />
          </label>

          <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "注册中..." : "注册"}
          </button>
        </form>

        <div className="auth-card__footer">
          <span>已有账号？</span>
          <button className="text-button" onClick={handleSwitchToLogin} type="button">
            登录
          </button>
        </div>
      </div>
    </div>
  );
}
