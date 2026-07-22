import { describe, expect, it } from "vitest";
import { seedMeetings } from "@meeting-flow/shared";
import {
  applyMeetingRuntimeWriteback,
  applyNodeOutputMapping,
  buildWorkflowRuntimeContext,
  createWorkflowRuntimeStore,
  getPathValue,
  hydrateRuntimeStoreFromCompletedNodes,
  restoreWorkflowRuntimeStore,
  setPathValue
} from "../services/runtimeMapping.js";

describe("runtimeMapping", () => {
  it("writes nested runtime paths", () => {
    const store: Record<string, unknown> = { node: {} };
    setPathValue(store, "node.context.contextPack", "pack-text");

    expect(getPathValue(store, "node.context.contextPack")).toBe("pack-text");
  });

  it("applies output mapping into runtime store", () => {
    const meeting = seedMeetings[0]!;
    const runtimeStore = createWorkflowRuntimeStore(meeting);
    const node = {
      id: "context",
      executor: {
        type: "aiApplication" as const,
        label: "节点智能体",
        runtime: "agent" as const,
        inputMapping: {},
        outputMapping: {
          contextPack: "node.context.contextPack"
        }
      }
    };

    const mapped = applyNodeOutputMapping(
      node as never,
      {
        structuredOutput: { contextPack: "检索上下文" },
        contextPack: "检索上下文"
      },
      runtimeStore
    );

    expect(mapped.applied).toHaveLength(1);
    expect(getPathValue(runtimeStore, "node.context.contextPack")).toBe("检索上下文");
    expect(mapped.outputPayload.outputMappingApplied).toHaveLength(1);
  });

  it("merges runtime store with completed node runs", () => {
    const meeting = seedMeetings[0]!;
    const runtimeStore = createWorkflowRuntimeStore(meeting);
    setPathValue(runtimeStore, "node.ai.result", "from-mapping");

    const context = buildWorkflowRuntimeContext(
      meeting,
      new Map([
        [
          "ai",
          {
            nodeId: "ai",
            status: "success",
            outputPayload: { result: "from-run" }
          }
        ]
      ]),
      runtimeStore
    );

    expect(getPathValue(context, "node.ai.result")).toBe("from-mapping");
  });

  it("applies meeting runtime writeback from mapped store", () => {
    const meeting = seedMeetings[0]!;
    const runtimeStore = createWorkflowRuntimeStore(meeting);
    setPathValue(runtimeStore, "meeting.meetingGoal", "通过 Output Mapping 写回的新目标");

    const updated = applyMeetingRuntimeWriteback(meeting, runtimeStore);

    expect(updated?.meetingGoal).toBe("通过 Output Mapping 写回的新目标");
    expect(updated?.updatedAt).not.toBe(meeting.updatedAt);
  });

  it("restores runtime snapshot on top of current meeting payload", () => {
    const meeting = seedMeetings[0]!;
    const snapshot = createWorkflowRuntimeStore(meeting);
    setPathValue(snapshot, "node.context.contextPack", "历史上下文");

    const restored = restoreWorkflowRuntimeStore(meeting, snapshot);

    expect(getPathValue(restored, "node.context.contextPack")).toBe("历史上下文");
    expect(getPathValue(restored, "meeting.meetingId")).toBe(meeting.id);
  });

  it("hydrates runtime store from completed node runs when snapshot is missing", () => {
    const meeting = seedMeetings[0]!;
    const runtimeStore = createWorkflowRuntimeStore(meeting);
    const template = {
      nodes: [
        {
          id: "context",
          executor: {
            type: "aiApplication" as const,
            label: "节点智能体",
            runtime: "agent" as const,
            inputMapping: {},
            outputMapping: {
              contextPack: "meeting.meetingGoal"
            }
          }
        }
      ]
    };

    const nodeResults = hydrateRuntimeStoreFromCompletedNodes(
      template as never,
      [
        {
          nodeId: "context",
          status: "success",
          outputPayload: {
            structuredOutput: { contextPack: "恢复后的目标" },
            contextPack: "恢复后的目标"
          }
        }
      ],
      runtimeStore
    );

    expect(nodeResults.size).toBe(1);
    expect(getPathValue(runtimeStore, "meeting.meetingGoal")).toBe("恢复后的目标");
  });
});
