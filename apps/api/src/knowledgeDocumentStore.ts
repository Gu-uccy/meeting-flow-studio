import { withDatabase } from "./lib/db/index.js";
import { orderByTimestampColumn } from "./lib/db/migrations.js";

export type KnowledgeDocument = {
  content: string;
  createdAt: string;
  format: "markdown" | "text";
  id: string;
  meetingId: string;
  ownerUserId: string;
  title: string;
  updatedAt: string;
};

function rowToDocument(row: {
  content: string;
  created_at: string;
  format: string;
  id: string;
  meeting_id: string;
  owner_user_id: string;
  title: string;
  updated_at: string;
}): KnowledgeDocument {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    content: row.content,
    format: row.format === "markdown" ? "markdown" : "text",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listKnowledgeDocuments(meetingId?: string) {
  return withDatabase(async (db) => {
    const orderBy = orderByTimestampColumn("updated_at", db.driver);
    const rows = meetingId
      ? await db
          .prepare(`SELECT * FROM knowledge_documents WHERE meeting_id = ? ORDER BY ${orderBy}`)
          .all<Parameters<typeof rowToDocument>[0]>(meetingId)
      : await db
          .prepare(`SELECT * FROM knowledge_documents ORDER BY ${orderBy}`)
          .all<Parameters<typeof rowToDocument>[0]>();

    return rows.map(rowToDocument);
  });
}

export async function createKnowledgeDocument(params: {
  meetingId: string;
  ownerUserId: string;
  title: string;
  content: string;
  format?: "markdown" | "text";
}) {
  const now = new Date().toISOString();
  const document: KnowledgeDocument = {
    id: `kdoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    meetingId: params.meetingId,
    ownerUserId: params.ownerUserId,
    title: params.title.trim() || "未命名文档",
    content: params.content.trim(),
    format: params.format ?? "text",
    createdAt: now,
    updatedAt: now
  };

  await withDatabase(async (db) => {
    await db
      .prepare(`
        INSERT INTO knowledge_documents (id, meeting_id, owner_user_id, title, content, format, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        document.id,
        document.meetingId,
        document.ownerUserId,
        document.title,
        document.content,
        document.format,
        document.createdAt,
        document.updatedAt
      );
  });

  return document;
}

export async function deleteKnowledgeDocument(id: string) {
  return withDatabase(async (db) => {
    const result = await db.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(id);
    return result.changes > 0;
  });
}

const SEED_KNOWLEDGE_DOCUMENTS: Array<{
  id: string;
  meetingId: string;
  title: string;
  content: string;
  format: "markdown" | "text";
}> = [
  {
    id: "kdoc-seed-weekly-01",
    meetingId: "meeting-001",
    title: "产品周例会 · 版本节奏说明",
    format: "markdown",
    content: `# 版本节奏说明

## 本周目标
- 完成审批链路改造的技术方案评审
- 明确导出能力的首期范围

## 关键风险
1. 依赖「权限服务」的接口尚未冻结
2. 客户试点环境下周才可开通

## 建议议程
1. 回顾上周行动项
2. 确认优先级与责任人
3. 对齐对外沟通口径`
  },
  {
    id: "kdoc-seed-weekly-02",
    meetingId: "meeting-001",
    title: "跨团队依赖清单",
    format: "text",
    content: `依赖清单（产品周例会）
- 设计：导出页交互稿需在周三前定稿
- 后端：审批回调契约需与权限中心对齐
- 数据：客户试点名单由客户成功同步
- 质量：回归范围覆盖「创建会议 → 审批 → 通知」主路径`
  },
  {
    id: "kdoc-seed-weekly-03",
    meetingId: "meeting-001",
    title: "上周行动项回顾",
    format: "markdown",
    content: `# 上周行动项

| 事项 | 责任人 | 状态 |
| --- | --- | --- |
| 整理版本风险清单 | 王立 | 进行中 |
| 对齐权限服务契约 | 周舟 | 待开始 |
| 准备客户试点 FAQ | 林一 | 已完成 |

说明：风险清单需在会前补充「阻塞原因」与「解法建议」两列。`
  },
  {
    id: "kdoc-seed-weekly-04",
    meetingId: "meeting-001",
    title: "对外沟通口径（草稿）",
    format: "text",
    content: `对外沟通口径草稿
1. 本迭代聚焦「审批加速 + 导出可用性」，暂不承诺 SSO。
2. 试点客户支持窗口：工作日 10:00–18:00。
3. 若权限服务延期，优先保证会前准备链路可用，导出可降级为手动。`
  },
  {
    id: "kdoc-seed-client-01",
    meetingId: "meeting-002",
    title: "客户试点反馈摘要",
    format: "markdown",
    content: `# 客户试点反馈

## 已确认诉求
- 缩短会前审批等待时间
- 支持会后纪要一键导出

## 未决问题
- 是否需要对接客户侧 SSO
- 导出格式优先 PDF 还是 Markdown

## 会谈目标
对齐下一阶段上线范围与支持计划，形成可执行的推进事项。`
  },
  {
    id: "kdoc-seed-client-02",
    meetingId: "meeting-002",
    title: "项目支持计划草案",
    format: "text",
    content: `支持计划草案
1. 专属对接人：客户成功周行
2. 响应时效：工作日 4 小时内首响
3. 培训安排：上线前完成 1 场管理员培训
4. 验收标准：审批平均耗时下降 30%，导出成功率 ≥ 99%`
  },
  {
    id: "kdoc-seed-client-03",
    meetingId: "meeting-002",
    title: "竞品对照要点",
    format: "markdown",
    content: `# 竞品对照（节选）

## 我们的差异点
- 会议全链路可编排（会前 → 会中锚点 → 会后纪要）
- 纪要节点可绑定真实录音，减少臆造

## 客户关心的对比项
1. 导入存量会议成本
2. 权限模型是否可映射到客户 AD
3. 导出是否可进入客户知识库`
  },
  {
    id: "kdoc-seed-interview-01",
    meetingId: "meeting-003",
    title: "候选人简历摘要",
    format: "markdown",
    content: `# 候选人简历摘要

- 方向：5 年，偏后端与流程编排
- 亮点：主导过审批中台与开放 API
- 风险：对前端可视化经验偏少

面试建议：重点验证「复杂流程拆解」与「跨团队推动」能力。`
  },
  {
    id: "kdoc-seed-interview-02",
    meetingId: "meeting-003",
    title: "面试评分维度",
    format: "text",
    content: `评分维度
1. 问题拆解（权重 30%）
2. 系统设计（权重 30%）
3. 沟通表达（权重 20%）
4. 协作意识（权重 20%）

通过线：加权总分 ≥ 3.5 / 5`
  }
];

/** Idempotent seed for demo knowledge documents on known meetings. */
export async function ensureSeedKnowledgeDocuments() {
  return withDatabase(async (db) => {
    for (const seed of SEED_KNOWLEDGE_DOCUMENTS) {
      const existing = await db
        .prepare("SELECT id FROM knowledge_documents WHERE id = ?")
        .get<{ id: string }>(seed.id);

      if (existing) {
        continue;
      }

      const now = new Date().toISOString();
      await db
        .prepare(`
          INSERT INTO knowledge_documents (id, meeting_id, owner_user_id, title, content, format, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(seed.id, seed.meetingId, "user-admin-001", seed.title, seed.content, seed.format, now, now);
    }
  });
}

const DEMO_PACK_FOR_MEETING: Array<{
  suffix: string;
  title: string;
  content: string;
  format: "markdown" | "text";
}> = [
  {
    suffix: "brief",
    title: "会前背景简报",
    format: "markdown",
    content: `# 会前背景简报

## 背景
本场会议用于对齐目标、风险与下一步行动。

## 请会前阅读
1. 当前阻塞与依赖
2. 待决策事项清单
3. 相关客户/项目约束`
  },
  {
    suffix: "checklist",
    title: "决策检查清单",
    format: "text",
    content: `决策检查清单
- 目标是否可衡量？
- 责任人是否明确？
- 截止时间是否可执行？
- 风险是否有兜底方案？
- 会后通知对象是否齐全？`
  },
  {
    suffix: "glossary",
    title: "术语与约定",
    format: "markdown",
    content: `# 术语与约定

- **Run**：一次流程运行实例
- **阻塞节点**：等待外部条件或人工处理后才能继续
- **外部会议**：飞书等会议应用中的真实会议锚点`
  },
  {
    suffix: "faq",
    title: "常见问题 FAQ",
    format: "text",
    content: `FAQ
Q: 知识库和会议记忆有什么区别？
A: 知识库是会前上传的参考材料；记忆是流程跑完后沉淀的经验。

Q: 为什么检索不到？
A: 请先重建向量索引，并确认已配置可用的 Embedding。`
  }
];

/** Idempotent demo pack for any meeting (used by “填充示例文档”). */
export async function ensureDemoKnowledgePackForMeeting(meetingId: string, ownerUserId = "user-admin-001") {
  const created: KnowledgeDocument[] = [];

  await withDatabase(async (db) => {
    for (const item of DEMO_PACK_FOR_MEETING) {
      const id = `kdoc-demo-${meetingId}-${item.suffix}`;
      const existing = await db
        .prepare("SELECT id FROM knowledge_documents WHERE id = ?")
        .get<{ id: string }>(id);

      if (existing) {
        continue;
      }

      const now = new Date().toISOString();
      await db
        .prepare(`
          INSERT INTO knowledge_documents (id, meeting_id, owner_user_id, title, content, format, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(id, meetingId, ownerUserId, item.title, item.content, item.format, now, now);

      created.push({
        id,
        meetingId,
        ownerUserId,
        title: item.title,
        content: item.content,
        format: item.format,
        createdAt: now,
        updatedAt: now
      });
    }
  });

  return created;
}
