import { describe, it, expect, beforeAll } from "vitest";
import { buildTestApp, registerAndGetToken, createTestMeeting } from "../lib/testApp.js";
import { syncVectorKnowledgeIndex } from "../vectorStore.js";
import { retrieveMeetingKnowledge } from "../services/knowledgeRetrieval.js";
import type { FastifyInstance } from "fastify";
import type { MeetingMemory } from "@meeting-flow/shared";

describe("Vector knowledge retrieval", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    const auth = await registerAndGetToken(app);
    token = auth.token;
  });

  it("searches indexed memories by semantic similarity", async () => {
    const { meeting } = await createTestMeeting(app, token, {
      title: "OKR 复盘周会",
      meetingGoal: "复盘上季度 OKR 完成情况"
    });

    const memories: MeetingMemory[] = [
      {
        id: "memory-okr-1",
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        ownerUserId: meeting.ownerUserId,
        sourceRunId: "run-test",
        kind: "summary",
        content: "上季度 OKR 完成率 78%，销售线表现最好。",
        source: "workflow",
        visibility: "team",
        confidence: 0.9,
        isPinned: false,
        tags: [],
        relatedParticipantNames: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: "memory-weather-1",
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        ownerUserId: meeting.ownerUserId,
        sourceRunId: "run-test",
        kind: "preference",
        content: "团队偏好把周会安排在周一上午。",
        source: "workflow",
        visibility: "team",
        confidence: 0.7,
        isPinned: false,
        tags: [],
        relatedParticipantNames: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    await syncVectorKnowledgeIndex(memories, [meeting]);

    const result = await retrieveMeetingKnowledge(meeting, {
      query: "OKR 复盘完成率",
      maxDocs: 2
    });

    expect(result.retrievalMode).toMatch(/^vector-/);
    expect(result.contextPack[0]?.content).toContain("OKR");
    expect(result.topSimilarity).toBeGreaterThan(0);
  });

  it("GET /api/knowledge/search returns ranked hits", async () => {
    const { meeting } = await createTestMeeting(app, token, {
      title: "向量检索 API 测试",
      meetingGoal: "验证 knowledge search API"
    });

    await syncVectorKnowledgeIndex(
      [
        {
          id: "memory-api-1",
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingType: meeting.type,
          ownerUserId: meeting.ownerUserId,
          sourceRunId: "run-api",
          kind: "decision",
          content: "决定采用向量检索替代关键词排序。",
          source: "workflow",
          visibility: "team",
          confidence: 0.88,
          isPinned: false,
          tags: [],
          relatedParticipantNames: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      [meeting]
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/knowledge/search?meetingId=${meeting.id}&q=${encodeURIComponent("向量检索")}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].similarity).toBeGreaterThan(0);
    expect(body.items[0].sourceId).toBeTruthy();
  });

  it("indexes long memories as multiple chunks and retrieves the relevant section", async () => {
    const { meeting } = await createTestMeeting(app, token, {
      title: "长文档检索测试",
      meetingGoal: "验证向量分片后的语义召回"
    });

    const longMemoryContent = [
      `第一部分：团队组织与角色分工已经确认。${"组织细节补充。".repeat(30)}`,
      `第二部分：上季度 OKR 完成率 78%，销售线表现最好，产品线的留存指标未达标。${"OKR 细节补充。".repeat(30)}`,
      `第三部分：客户 A 项目存在接口延期风险，需要会后同步给交付负责人。${"风险细节补充。".repeat(30)}`,
      `第四部分：下次周会继续跟踪行动项与阻塞项。${"行动项细节补充。".repeat(30)}`
    ].join("\n\n");

    const syncStats = await syncVectorKnowledgeIndex(
      [
        {
          id: "memory-long-1",
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          meetingType: meeting.type,
          ownerUserId: meeting.ownerUserId,
          sourceRunId: "run-long",
          kind: "summary",
          content: longMemoryContent,
          source: "workflow",
          visibility: "team",
          confidence: 0.92,
          isPinned: false,
          tags: [],
          relatedParticipantNames: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      [meeting]
    );

    expect(syncStats.chunkCount).toBeGreaterThan(1);

    const result = await retrieveMeetingKnowledge(meeting, {
      query: "OKR 完成率 78%",
      maxDocs: 3
    });

    expect(result.retrievalMode).toMatch(/^vector-/);
    expect(result.contextPack.some((item) => item.content.includes("OKR"))).toBe(true);
    expect(result.contextPack.some((item) => item.content.includes("接口延期"))).toBe(false);
  });
});
