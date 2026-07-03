import { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";
import type {
  ProductWorkflowEdge,
  ProductWorkflowNode,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";

type WorkflowTemplatesResponse = {
  items: ProductWorkflowTemplate[];
};

type WorkflowRunsResponse = {
  items: ProductWorkflowRun[];
};

type WorkflowRunMutationResponse = {
  run: ProductWorkflowRun;
  message: string;
};

type WorkflowTemplateMutationResponse = {
  template: ProductWorkflowTemplate;
  message: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

function sortRunsByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

export function useWorkflowLibrary(isEnabled = true) {
  const [templates, setTemplates] = useState<ProductWorkflowTemplate[]>([]);
  const [runs, setRuns] = useState<ProductWorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEnabled) {
      setTemplates([]);
      setRuns([]);
      setIsLoading(false);
      setError("");
      setFeedback("");
      return;
    }

    void loadWorkflowLibrary();
  }, [isEnabled]);

  async function loadWorkflowLibrary() {
    setIsLoading(true);
    setError("");

    try {
      const [templatesResponse, runsResponse] = await Promise.all([
        apiClient("/api/workflows/templates"),
        apiClient("/api/workflows/runs")
      ]);

      const [templatesData, runsData] = (await Promise.all([
        templatesResponse.json(),
        runsResponse.json()
      ])) as [WorkflowTemplatesResponse, WorkflowRunsResponse];

      if (!templatesResponse.ok) {
        throw new Error("工作流模板加载失败，请稍后重试。");
      }

      if (!runsResponse.ok) {
        throw new Error("运行记录加载失败，请稍后重试。");
      }

      setTemplates(templatesData.items);
      setRuns(runsData.items);
    } catch (requestError) {
      setError(parseErrorMessage("工作流数据加载失败，请稍后重试。", requestError));
    } finally {
      setIsLoading(false);
    }
  }

  async function startWorkflowRun(meetingId: string, templateId?: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/workflows/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ meetingId, templateId })
      });
      const data = (await response.json()) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程启动失败，请稍后重试。");
      }

      setRuns((currentRuns) =>
        [data.run as ProductWorkflowRun, ...currentRuns.filter((run) => run.id !== data.run?.id)].sort(
          sortRunsByStartedAtDesc
        )
      );
      setFeedback(data.message ?? "流程已启动");
      return data.run;
    } catch (requestError) {
      setError(parseErrorMessage("流程启动失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function advanceWorkflowRun(runId: string, resolutionNote: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/runs/${runId}/advance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ resolutionNote })
      });
      const data = (await response.json()) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程推进失败，请稍后重试。");
      }

      setRuns((currentRuns) =>
        currentRuns
          .map((run) => (run.id === data.run?.id ? (data.run as ProductWorkflowRun) : run))
          .sort(sortRunsByStartedAtDesc)
      );
      setFeedback(data.message ?? "流程已继续运行");
      return data.run;
    } catch (requestError) {
      setError(parseErrorMessage("流程推进失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function saveNodeConfig(templateId: string, nodeId: string, fields: Array<{ key: string; value: string }>) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/nodes/${nodeId}/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      });
      const data = (await response.json()) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "节点配置保存失败，请稍后重试。");
      }

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "节点配置已保存");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("节点配置保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function saveTemplateCanvas(
    templateId: string,
    nodes: ProductWorkflowNode[],
    edges: ProductWorkflowEdge[]
  ) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/canvas`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nodes, edges })
      });
      const data = (await response.json()) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "画布保存失败，请稍后重试。");
      }

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "画布已保存");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("画布保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function retryWorkflowRun(runId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/runs/${runId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = (await response.json()) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程重试失败，请稍后重试。");
      }

      setRuns((currentRuns) =>
        [data.run as ProductWorkflowRun, ...currentRuns.filter((run) => run.id !== data.run?.id)].sort(
          sortRunsByStartedAtDesc
        )
      );
      setFeedback(data.message ?? "流程已重新启动");
      return data.run;
    } catch (requestError) {
      setError(parseErrorMessage("流程重试失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function cancelWorkflowRun(runId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/runs/${runId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = (await response.json()) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程取消失败，请稍后重试。");
      }

      setRuns((currentRuns) =>
        currentRuns
          .map((run) => (run.id === data.run?.id ? (data.run as ProductWorkflowRun) : run))
          .sort(sortRunsByStartedAtDesc)
      );
      setFeedback(data.message ?? "流程已取消");
      return data.run;
    } catch (requestError) {
      setError(parseErrorMessage("流程取消失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    advanceWorkflowRun,
    cancelWorkflowRun,
    error,
    feedback,
    isLoading,
    isMutating,
    reloadWorkflowLibrary: loadWorkflowLibrary,
    runs,
    saveNodeConfig,
    retryWorkflowRun,
    saveTemplateCanvas,
    startWorkflowRun,
    templates
  };
}
