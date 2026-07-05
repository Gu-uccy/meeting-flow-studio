import { useEffect, useRef, useState } from "react";
import { apiClient, getWorkflowWebSocketUrl } from "../lib/apiClient";
import type {
  AiApplication,
  AiApplicationInputField,
  AiApplicationOutputField,
  AiApplicationPromptConfig,
  AiApplicationVersion,
  MiniDifyNodeCapability,
  ProductWorkflowEdge,
  ProductWorkflowNode,
  ProductWorkflowNodeExecutor,
  ProductWorkflowRun,
  ProductWorkflowTemplate
} from "@meeting-flow/shared";

type WorkflowTemplatesResponse = {
  items: ProductWorkflowTemplate[];
};

type WorkflowRunsResponse = {
  items: ProductWorkflowRun[];
};

type AiApplicationsResponse = {
  items: AiApplication[];
};

type NodeCapabilitiesResponse = {
  items: MiniDifyNodeCapability[];
};

type WorkflowRunMutationResponse = {
  run: ProductWorkflowRun;
  message: string;
};

type WorkflowTemplateMutationResponse = {
  template: ProductWorkflowTemplate;
  message: string;
};

type ApplicationStatusMutationResponse = {
  application: AiApplication;
  template: ProductWorkflowTemplate;
  message: string;
};

type ApplicationSchemaMutationResponse = {
  application: AiApplication;
  template: ProductWorkflowTemplate;
  message: string;
};

type ApplicationPromptMutationResponse = {
  application: AiApplication;
  template: ProductWorkflowTemplate;
  message: string;
};

type ApplicationVersionMutationResponse = {
  application: AiApplication;
  template: ProductWorkflowTemplate;
  version: AiApplicationVersion;
  message: string;
};

type NodeExecutorMutationResponse = {
  applications: AiApplication[];
  template: ProductWorkflowTemplate;
  message: string;
};

type ApplicationDebugMutationResponse = {
  application: AiApplication;
  inputs: Record<string, unknown>;
  run: ProductWorkflowRun;
  message: string;
};

function parseErrorMessage(fallback: string, value: unknown) {
  return value instanceof Error ? value.message : fallback;
}

function sortRunsByStartedAtDesc(left: ProductWorkflowRun, right: ProductWorkflowRun) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

function mergeRunUpdate(currentRuns: ProductWorkflowRun[], run: ProductWorkflowRun) {
  return [run, ...currentRuns.filter((item) => item.id !== run.id)].sort(sortRunsByStartedAtDesc);
}

export function useWorkflowLibrary(isEnabled = true) {
  const [applications, setApplications] = useState<AiApplication[]>([]);
  const [nodeCapabilities, setNodeCapabilities] = useState<MiniDifyNodeCapability[]>([]);
  const [templates, setTemplates] = useState<ProductWorkflowTemplate[]>([]);
  const [runs, setRuns] = useState<ProductWorkflowRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const isEnabledRef = useRef(isEnabled);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      setApplications([]);
      setNodeCapabilities([]);
      setTemplates([]);
      setRuns([]);
      setIsLoading(false);
      setError("");
      setFeedback("");
      return;
    }

    void loadWorkflowLibrary();
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByUser = false;

    function connect() {
      socket = new WebSocket(getWorkflowWebSocketUrl());

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: ProductWorkflowRun;
          };

          if (message.type === "workflow:update" && message.payload) {
            setRuns((currentRuns) => mergeRunUpdate(currentRuns, message.payload as ProductWorkflowRun));
          }
        } catch {
          // Ignore malformed push payloads.
        }
      });

      socket.addEventListener("close", () => {
        if (!closedByUser && isEnabledRef.current) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      });
    }

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [isEnabled]);

  async function loadWorkflowLibrary() {
    setIsLoading(true);
    setError("");

    try {
      const [templatesResponse, runsResponse, applicationsResponse, nodeCapabilitiesResponse] = await Promise.all([
        apiClient("/api/workflows/templates"),
        apiClient("/api/workflows/runs"),
        apiClient("/api/apps"),
        apiClient("/api/catalog/node-capabilities")
      ]);

      const [templatesData, runsData, applicationsData, nodeCapabilitiesData] = (await Promise.all([
        templatesResponse.json(),
        runsResponse.json(),
        applicationsResponse.json(),
        nodeCapabilitiesResponse.json()
      ])) as [WorkflowTemplatesResponse, WorkflowRunsResponse, AiApplicationsResponse, NodeCapabilitiesResponse];

      if (!templatesResponse.ok) {
        throw new Error("工作流模板加载失败，请稍后重试。");
      }

      if (!runsResponse.ok) {
        throw new Error("运行记录加载失败，请稍后重试。");
      }

      if (!applicationsResponse.ok) {
        throw new Error("AI 应用目录加载失败，请稍后重试。");
      }

      if (!nodeCapabilitiesResponse.ok) {
        throw new Error("节点能力目录加载失败，请稍后重试。");
      }

      setApplications(applicationsData.items);
      setNodeCapabilities(nodeCapabilitiesData.items);
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

      setRuns((currentRuns) => mergeRunUpdate(currentRuns, data.run as ProductWorkflowRun));
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

  async function saveNodeExecutor(templateId: string, nodeId: string, executor: ProductWorkflowNodeExecutor) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/nodes/${nodeId}/executor`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ executor })
      });
      const data = (await response.json()) as Partial<NodeExecutorMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "节点执行器保存失败，请稍后重试。");
      }

      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      if (data.applications) {
        setApplications((currentApplications) => {
          const nextById = new Map(
            currentApplications
              .filter((application) => application.templateId !== data.template?.id)
              .map((application) => [application.id, application])
          );
          data.applications?.forEach((application) => nextById.set(application.id, application));
          return [...nextById.values()];
        });
      }
      setFeedback(data.message ?? "节点执行器已保存");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("节点执行器保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateApplicationSchema(
    applicationId: string,
    inputSchema: AiApplicationInputField[],
    outputSchema: AiApplicationOutputField[]
  ) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/schema`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputSchema, outputSchema })
      });
      const data = (await response.json()) as Partial<ApplicationSchemaMutationResponse> & { message?: string };

      if (!response.ok || !data.application || !data.template) {
        throw new Error(data.message ?? "节点智能体 Schema 保存失败，请稍后重试。");
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === data.application?.id ? (data.application as AiApplication) : application
        )
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "节点智能体 Schema 已保存");
      return data.application;
    } catch (requestError) {
      setError(parseErrorMessage("节点智能体 Schema 保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function updateApplicationPromptConfig(applicationId: string, promptConfig: AiApplicationPromptConfig) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/prompt`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(promptConfig)
      });
      const data = (await response.json()) as Partial<ApplicationPromptMutationResponse> & { message?: string };

      if (!response.ok || !data.application || !data.template) {
        throw new Error(data.message ?? "节点智能体 Prompt 保存失败，请稍后重试。");
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === data.application?.id ? (data.application as AiApplication) : application
        )
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "节点智能体 Prompt 已保存");
      return data.application;
    } catch (requestError) {
      setError(parseErrorMessage("节点智能体 Prompt 保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function createApplicationVersion(
    applicationId: string,
    status: AiApplicationVersion["status"],
    summary = ""
  ) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status, summary })
      });
      const data = (await response.json()) as Partial<ApplicationVersionMutationResponse> & { message?: string };

      if (!response.ok || !data.application || !data.template || !data.version) {
        throw new Error(data.message ?? "\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === data.application?.id ? (data.application as AiApplication) : application
        )
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u5df2\u4fdd\u5b58");
      return data.version;
    } catch (requestError) {
      setError(parseErrorMessage("\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function applyApplicationVersion(applicationId: string, versionId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/versions/${versionId}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = (await response.json()) as Partial<ApplicationVersionMutationResponse> & { message?: string };

      if (!response.ok || !data.application || !data.template || !data.version) {
        throw new Error(data.message ?? "\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u5e94\u7528\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === data.application?.id ? (data.application as AiApplication) : application
        )
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u5df2\u5e94\u7528");
      return data.version;
    } catch (requestError) {
      setError(parseErrorMessage("\u8282\u70b9\u667a\u80fd\u4f53\u7248\u672c\u5e94\u7528\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002", requestError));
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

      setRuns((currentRuns) => mergeRunUpdate(currentRuns, data.run as ProductWorkflowRun));
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

  async function updateApplicationStatus(applicationId: string, status: "draft" | "published") {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = (await response.json()) as Partial<ApplicationStatusMutationResponse> & { message?: string };

      if (!response.ok || !data.application || !data.template) {
        throw new Error(data.message ?? "应用状态更新失败，请稍后重试。");
      }

      setApplications((currentApplications) =>
        currentApplications.map((application) =>
          application.id === data.application?.id ? (data.application as AiApplication) : application
        )
      );
      setTemplates((currentTemplates) =>
        currentTemplates.map((template) =>
          template.id === data.template?.id ? (data.template as ProductWorkflowTemplate) : template
        )
      );
      setFeedback(data.message ?? "应用状态已更新");
      return data.application;
    } catch (requestError) {
      setError(parseErrorMessage("应用状态更新失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function debugApplication(applicationId: string, inputs: Record<string, unknown>) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/apps/${applicationId}/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs })
      });
      const data = (await response.json()) as Partial<ApplicationDebugMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "应用调试运行失败，请稍后重试。");
      }

      setRuns((currentRuns) => mergeRunUpdate(currentRuns, data.run as ProductWorkflowRun));
      setFeedback(data.message ?? "应用调试运行已完成");
      return {
        inputs: data.inputs ?? inputs,
        run: data.run
      };
    } catch (requestError) {
      setError(parseErrorMessage("应用调试运行失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    advanceWorkflowRun,
    applyApplicationVersion,
    applications,
    cancelWorkflowRun,
    createApplicationVersion,
    debugApplication,
    error,
    feedback,
    isLoading,
    isMutating,
    nodeCapabilities,
    reloadWorkflowLibrary: loadWorkflowLibrary,
    runs,
    saveNodeConfig,
    saveNodeExecutor,
    retryWorkflowRun,
    saveTemplateCanvas,
    startWorkflowRun,
    templates,
    updateApplicationPromptConfig,
    updateApplicationSchema,
    updateApplicationStatus
  };
}
