import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkflowUnsavedGuard } from "./useWorkflowUnsavedGuard";

describe("useWorkflowUnsavedGuard", () => {
  it("switches template immediately when canvas is clean", () => {
    const onSelectTemplate = vi.fn();
    const { result } = renderHook(() => useWorkflowUnsavedGuard(false));

    act(() => {
      result.current.requestTemplateSwitch("tpl-b", "tpl-a", onSelectTemplate);
    });

    expect(onSelectTemplate).toHaveBeenCalledWith("tpl-b");
    expect(result.current.pendingTemplateId).toBeNull();
  });

  it("defers template switch when canvas is dirty", () => {
    const onSelectTemplate = vi.fn();
    const { result } = renderHook(() => useWorkflowUnsavedGuard(true));

    act(() => {
      result.current.requestTemplateSwitch("tpl-b", "tpl-a", onSelectTemplate);
    });

    expect(onSelectTemplate).not.toHaveBeenCalled();
    expect(result.current.pendingTemplateId).toBe("tpl-b");

    act(() => {
      result.current.confirmTemplateSwitch(onSelectTemplate);
    });

    expect(onSelectTemplate).toHaveBeenCalledWith("tpl-b");
    expect(result.current.pendingTemplateId).toBeNull();
  });

  it("cancels pending template switch", () => {
    const onSelectTemplate = vi.fn();
    const { result } = renderHook(() => useWorkflowUnsavedGuard(true));

    act(() => {
      result.current.requestTemplateSwitch("tpl-b", "tpl-a", onSelectTemplate);
      result.current.cancelTemplateSwitch();
    });

    expect(onSelectTemplate).not.toHaveBeenCalled();
    expect(result.current.pendingTemplateId).toBeNull();
  });
});
