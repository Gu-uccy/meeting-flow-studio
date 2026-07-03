import { meetingFlowProduct } from "@meeting-flow/shared";
import { BrandMark } from "../common/BrandMark";
import { ProductWorkflowPreview } from "../workflow/ProductWorkflowPreview";

type LandingPageProps = {
  onLoginClick: () => void;
  onRegisterClick: () => void;
};

export function LandingPage({ onLoginClick, onRegisterClick }: LandingPageProps) {
  return (
    <div className="retool-shell public-product-shell">
      <header className="marketing-nav">
        <a className="marketing-nav__brand" href="#top" aria-label={meetingFlowProduct.name}>
          <BrandMark />
          <span>{meetingFlowProduct.name}</span>
        </a>
        <nav aria-label="产品导航">
          <a href="#workflow-preview">流程预览</a>
          <a href="#capabilities">能力</a>
          <a href="#use">使用</a>
        </nav>
        <button className="nav-cta" onClick={onLoginClick} type="button">
          登录使用
        </button>
      </header>

      <main id="top">
        <section className="retool-hero public-hero" aria-labelledby="landing-title">
          <div className="retool-hero__copy">
            <h1 id="landing-title">
              <span>会议流程</span>
              <span>编排工作台</span>
            </h1>
            <p>{meetingFlowProduct.subheadline}</p>
            <div className="retool-hero__actions">
              <button className="primary-button landing-cta-button" onClick={onLoginClick} type="button">
                登录
              </button>
            </div>
          </div>

          <div className="retool-hero__preview" id="workflow-preview">
            <ProductWorkflowPreview />
          </div>
        </section>

        <section className="how-section public-capabilities" id="capabilities" aria-labelledby="capabilities-title">
          <div className="how-section__intro">
            <span className="section-kicker">Capabilities</span>
            <h2 id="capabilities-title">把会议从日程，变成可追踪的流程</h2>
            <p>{meetingFlowProduct.productPromise}</p>
          </div>
          <div className="how-section__grid">
            {meetingFlowProduct.modules.slice(0, 3).map((module) => (
              <article className="how-step" key={module.id}>
                <span>{module.name}</span>
                <h3>{module.description}</h3>
                <p>{module.primaryObjects.join(" / ")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-access" id="use" aria-labelledby="use-title">
          <div className="landing-access__copy">
            <span className="section-kicker">Use</span>
            <h2 id="use-title">使用项目</h2>
            <p>登录后直接进入会议队列、工作流模板和节点配置，不再在展示页和工作台之间来回切换。</p>
          </div>
          <div className="landing-access__actions">
            <button className="primary-button landing-cta-button landing-cta-button--large" onClick={onLoginClick} type="button">
              登录
            </button>
            <button className="ghost-button" onClick={onRegisterClick} type="button">
              创建账号
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
