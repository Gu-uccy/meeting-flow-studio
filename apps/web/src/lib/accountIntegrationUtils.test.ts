import { describe, expect, it } from "vitest";
import type { AiApplication, ProductWorkflowRun } from "@meeting-flow/shared";
import {
  buildPlatformOverviewStats,
  getAiIntegrationStatus,
  getCalendarIntegrationStatus,
  getKnowledgeIntegrationStatus,
  getServiceApiIntegrationStatus
} from "./accountIntegrationUtils";

describe("accountIntegrationUtils", () => {
  it("describes AI integration by key source", () => {
    expect(getAiIntegrationStatus({
      provider: "anthropic",
      isUserConfigured: true,
      isEnvironmentConfigured: false,
      keySource: "user",
      keyHint: "****abcd",
      updatedAt: "2026-07-07T00:00:00.000Z"
    }, false).label).toBe("用户 Key");

    expect(getAiIntegrationStatus({
      provider: "anthropic",
      isUserConfigured: false,
      isEnvironmentConfigured: false,
      keySource: "none",
      keyHint: "",
      updatedAt: ""
    }, false).tone).toBe("attention");
  });

  it("describes calendar integration states", () => {
    expect(getCalendarIntegrationStatus({
      providerLabel: "Google Calendar",
      isConfigured: true,
      isConnected: true,
      isLoading: false
    }).tone).toBe("ready");

    expect(getCalendarIntegrationStatus({
      providerLabel: "飞书日历",
      isConfigured: false,
      isConnected: false,
      isLoading: false
    }).tone).toBe("unavailable");
  });

  it("describes knowledge index readiness", () => {
    expect(getKnowledgeIntegrationStatus({
      chunkCount: 12,
      chunking: { chunkOverlap: 50, chunkSize: 500 },
      dimensions: 1536,
      embeddingModel: "mock-local"
    }, false).tone).toBe("ready");
  });

  it("builds platform overview stats", () => {
    const runs: ProductWorkflowRun[] = [
      {
        id: "run-1",
        templateId: "tpl-1",
        meetingId: "meeting-1",
        name: "测试",
        status: "blocked",
        durationSeconds: 1,
        startedAt: "2026-07-07T00:00:00.000Z",
        nodeRuns: [{ nodeId: "n1", status: "blocked", startedAt: "", inputPayload: {} }],
        logs: []
      },
      {
        id: "run-2",
        templateId: "tpl-1",
        meetingId: "meeting-1",
        name: "测试 2",
        status: "running",
        durationSeconds: 2,
        startedAt: "2026-07-07T01:00:00.000Z",
        nodeRuns: [],
        logs: []
      }
    ];

    const applications = [
      { id: "app-1", status: "published" },
      { id: "app-2", status: "draft" }
    ] as AiApplication[];

    expect(buildPlatformOverviewStats({
      meetingCount: 3,
      templateCount: 2,
      applications,
      runs,
      serviceKeyCount: 1
    })).toEqual({
      meetingCount: 3,
      templateCount: 2,
      applicationCount: 2,
      publishedApplicationCount: 1,
      runCount: 2,
      blockedRunCount: 1,
      activeRunCount: 1,
      serviceKeyCount: 1
    });
  });

  it("describes service api integration", () => {
    expect(getServiceApiIntegrationStatus([], 0).tone).toBe("unavailable");
    expect(getServiceApiIntegrationStatus([{ status: "published" } as AiApplication], 2).tone).toBe("ready");
  });
});
