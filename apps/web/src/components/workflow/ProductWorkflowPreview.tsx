import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { BrandMark } from "../common/BrandMark";

const previewCanvas = {
  width: 660,
  height: 360,
  nodeWidth: 160,
  nodeHandleOffset: 8
};

const previewNodes = [
  {
    id: "trigger",
    kind: "触发器",
    title: "会议已创建",
    detail: "当新的会议申请被提交",
    x: 28,
    y: 66,
    tone: "trigger"
  },
  {
    id: "agenda",
    kind: "AI 节点",
    title: "生成议程",
    detail: "整理目标、议程和会前材料",
    x: 250,
    y: 54,
    tone: "ai"
  },
  {
    id: "context",
    kind: "查询",
    title: "加载上下文",
    detail: "读取 CRM、文档和历史纪要",
    x: 444,
    y: 66,
    tone: "query"
  },
  {
    id: "rule",
    kind: "条件",
    title: "需要审批?",
    detail: "参会人数 > 5 或客户会议",
    x: 28,
    y: 226,
    tone: "condition"
  },
  {
    id: "approval",
    kind: "人工节点",
    title: "请求审批",
    detail: "带上下文发送给负责人",
    x: 250,
    y: 226,
    tone: "approval"
  },
  {
    id: "tasks",
    kind: "动作",
    title: "分发任务",
    detail: "创建行动项并通知负责人",
    x: 444,
    y: 226,
    tone: "action"
  }
];

const previewEdges = [
  { source: "trigger", target: "agenda", status: "complete", label: "request" },
  { source: "agenda", target: "context", status: "running", label: "context" },
  { source: "agenda", target: "rule", status: "complete", label: "agenda" },
  { source: "context", target: "tasks", status: "queued", label: "notes" },
  { source: "rule", target: "approval", status: "warning", label: "if true" },
  { source: "approval", target: "tasks", status: "queued", label: "approved" }
];

const activity = [
  { time: "10:14:02", level: "info", text: "收到 meeting.created 触发事件" },
  { time: "10:14:04", level: "ok", text: "议程已在 1.8s 内生成" },
  { time: "10:14:06", level: "warn", text: "上下文查询缺少项目简报" },
  { time: "10:14:07", level: "info", text: "正在等待审批分支" }
];

const followUpActivity = [
  { time: "10:14:11", level: "ok", text: "负责人已处理审批分支" },
  { time: "10:14:13", level: "info", text: "行动项已同步到工作区" },
  { time: "10:14:15", level: "ok", text: "会议工作流已完成" },
  { time: "10:14:16", level: "info", text: "运行快照已保存用于回放" }
];

const visibleLogCount = 4;
const fullActivity = [...activity, ...followUpActivity];

function getNode(id: string) {
  return previewNodes.find((node) => node.id === id) ?? previewNodes[0];
}

function edgePath(sourceId: string, targetId: string) {
  const source = getNode(sourceId);
  const target = getNode(targetId);
  const startX = source.x + previewCanvas.nodeWidth - previewCanvas.nodeHandleOffset;
  const startY = source.y + 36;
  const endX = target.x;
  const endY = target.y + 36;
  const curve = Math.max(80, Math.abs(endX - startX) * 0.45);

  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

export function ProductWorkflowPreview() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const [logCursor, setLogCursor] = useState(0);
  const visibleActivity = useMemo(() => {
    return Array.from({ length: visibleLogCount }, (_, index) => fullActivity[(logCursor + index) % fullActivity.length]);
  }, [logCursor]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLogCursor((current) => (current + 1) % fullActivity.length);
    }, 2200);

    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const nextTiltX = Number((y * -5.5).toFixed(2));
    const nextTiltY = Number((x * 7).toFixed(2));
    const nextParallaxX = Number((x * 7).toFixed(2));
    const nextParallaxY = Number((y * -5.5).toFixed(2));

    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const element = previewRef.current;

      if (!element) {
        return;
      }

      element.style.setProperty("--tilt-x", `${nextTiltX}deg`);
      element.style.setProperty("--tilt-y", `${nextTiltY}deg`);
      element.style.setProperty("--parallax-x", `${nextParallaxX}px`);
      element.style.setProperty("--parallax-y", `${nextParallaxY}px`);
    });
  }

  function handlePointerLeave() {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      const element = previewRef.current;

      if (!element) {
        return;
      }

      element.style.setProperty("--tilt-x", "0deg");
      element.style.setProperty("--tilt-y", "0deg");
      element.style.setProperty("--parallax-x", "0px");
      element.style.setProperty("--parallax-y", "0px");
    });
  }

  return (
    <div
      className="product-preview-frame"
      aria-label="Meeting Flow 业务流快照"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={previewRef}
    >
      <div className="product-preview product-preview--animated">
        <div className="product-preview__topbar">
          <div className="product-preview__brand">
            <BrandMark compact />
            <div>
              <strong>会议申请 Meeting Flow</strong>
              <small>客户复盘会 / 自动编排中</small>
            </div>
          </div>
          <div className="product-preview__summary" aria-label="运行摘要">
            <span>6 个节点</span>
            <span>1 个阻塞</span>
            <span>1.8s 生成议程</span>
          </div>
        </div>

        <div className="product-preview__body">
          <main className="product-preview__canvas">
            <div className="product-preview__scan" aria-hidden="true" />
            <div className="product-preview__stage">
              <svg
                viewBox={`0 0 ${previewCanvas.width} ${previewCanvas.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {previewEdges.map((edge, index) => (
                  <g
                    className={`preview-edge preview-edge--${edge.status}`}
                    key={`${edge.source}-${edge.target}`}
                    style={{ "--edge-delay": `${index * 260}ms` } as CSSProperties}
                  >
                    <path d={edgePath(edge.source, edge.target)} />
                    <path className="preview-edge__sweep" d={edgePath(edge.source, edge.target)} />
                  </g>
                ))}
              </svg>

              {previewEdges.map((edge) => {
                const source = getNode(edge.source);
                const target = getNode(edge.target);

                return (
                  <span
                    className={`product-preview__edge-label product-preview__edge-label--${edge.status}`}
                    key={edge.label}
                    style={{
                      left: `${(source.x + target.x + previewCanvas.nodeWidth) / 2}px`,
                      top: `${(source.y + target.y + 64) / 2}px`
                    }}
                  >
                    {edge.label}
                  </span>
                );
              })}

              {previewNodes.map((node) => (
                <article
                  className={`product-preview__node product-preview__node--${node.tone}`}
                  key={node.id}
                  style={{ left: node.x, top: node.y, "--node-delay": `${previewNodes.indexOf(node) * 110}ms` } as CSSProperties}
                >
                  <div>
                    <span>{node.kind}</span>
                    <strong>{node.title}</strong>
                  </div>
                  <p>{node.detail}</p>
                  <footer>
                    <i aria-hidden="true" />
                    <small>{node.id === "context" ? "需补充" : "就绪"}</small>
                  </footer>
                </article>
              ))}
            </div>
          </main>

          <aside className="product-preview__snapshot" aria-label="流程快照">
            <div className="product-preview__snapshot-card">
              <span>当前节点</span>
              <strong>加载上下文</strong>
              <p>正在读取 CRM、历史纪要和项目文档，缺少项目简报。</p>
            </div>
            <div className="product-preview__metric-row">
              <div>
                <span>议程</span>
                <strong>3</strong>
              </div>
              <div>
                <span>行动项</span>
                <strong>2</strong>
              </div>
            </div>
            <div className="product-preview__timeline">
              <span>下一步</span>
              <ol>
                <li>补齐项目简报</li>
                <li>负责人审批客户会议</li>
                <li>同步行动项到工作区</li>
              </ol>
            </div>
          </aside>
        </div>

        <div className="product-preview__logs">
          {visibleActivity.map((item, index) => (
            <div
              className={`product-preview__log product-preview__log--${item.level}`}
              key={`${item.time}-${item.text}-${index}-${logCursor}`}
              style={{ "--log-delay": `${index * 90}ms` } as CSSProperties}
            >
              <span>{item.time}</span>
              <code>{item.text}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
