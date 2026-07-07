import { describe, expect, it } from "vitest";
import { seedMeetings } from "@meeting-flow/shared";
import {
  applyNodeOutputMapping,
  buildWorkflowRuntimeContext,
  createWorkflowRuntimeStore,
  getPathValue,
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
});
