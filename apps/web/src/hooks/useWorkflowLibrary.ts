import { useEffect, useRef, useState } from "react";
import { apiClient, getWorkflowWebSocketUrl, readJson } from "../lib/apiClient";
import type {
  AiApplication,
  AiApplicationInputField,
  AiApplicationOutputField,
  AiApplicationPromptConfig,
  AiApplicationVersion,
  ProductWorkflowEdge,
  ProductWorkflowNode,
  ProductWorkflowNodeExecutor,
  ProductWorkflowRun,
  ProductWorkflowTemplate,
  ProductWorkflowTemplateVersion
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

type WorkflowRunMutationResponse = {
  run: ProductWorkflowRun;
  message: string;
};

type WorkflowTemplateMutationResponse = {
  template: ProductWorkflowTemplate;
  message: string;
};

type WorkflowTemplateVersionMutationResponse = {
  template: ProductWorkflowTemplate;
  version: ProductWorkflowTemplateVersion;
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
      const [templatesResponse, runsResponse, applicationsResponse] = await Promise.all([
        apiClient("/api/workflows/templates"),
        apiClient("/api/workflows/runs"),
        apiClient("/api/apps")
      ]);

      const [templatesData, runsData, applicationsData] = (await Promise.all([
        readJson(templatesResponse),
        readJson(runsResponse),
        readJson(applicationsResponse)
      ])) as [WorkflowTemplatesResponse, WorkflowRunsResponse, AiApplicationsResponse];

      if (!templatesResponse.ok) {
        throw new Error("工作流模板加载失败，请稍后重试。");
      }

      if (!runsResponse.ok) {
        throw new Error("运行记录加载失败，请稍后重试。");
      }

      if (!applicationsResponse.ok) {
        throw new Error("AI 应用目录加载失败，请稍后重试。");
      }

      setApplications(applicationsData.items);
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
      const data = (await readJson(response)) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程启动失败，请稍后重试。");
      }

      setRuns((currentRuns) => mergeRunUpdate(currentRuns, data.run as ProductWorkflowRun));
      setFeedback(data.message ?? "流程已启动，正在后台执行");
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
      const data = (await readJson(response)) as Partial<WorkflowRunMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<NodeExecutorMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationSchemaMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationPromptMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationVersionMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationVersionMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

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
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const data = (await readJson(response)) as Partial<WorkflowRunMutationResponse> & { message?: string };

      if (!response.ok || !data.run) {
        throw new Error(data.message ?? "流程重试失败，请稍后重试。");
      }

      setRuns((currentRuns) => mergeRunUpdate(currentRuns, data.run as ProductWorkflowRun));
      setFeedback(data.message ?? "已从失败节点断点续跑");
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
      const data = (await readJson(response)) as Partial<WorkflowRunMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationStatusMutationResponse> & { message?: string };

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
      const data = (await readJson(response)) as Partial<ApplicationDebugMutationResponse> & { message?: string };

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

  async function createWorkflowTemplate(name?: string, sourceTemplateId?: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/workflows/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name ?? "新建工作流", sourceTemplateId })
      });
      const data = (await readJson(response)) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "创建模板失败，请稍后重试。");
      }

      setTemplates((current) => [data.template as ProductWorkflowTemplate, ...current]);
      setFeedback(data.message ?? "工作流模板已创建");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("创建模板失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function duplicateWorkflowTemplate(templateId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = (await readJson(response)) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "复制模板失败，请稍后重试。");
      }

      setTemplates((current) => [data.template as ProductWorkflowTemplate, ...current]);
      setFeedback(data.message ?? "工作流模板已复制");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("复制模板失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function deleteWorkflowTemplate(templateId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}`, { method: "DELETE" });
      const data = (await readJson(response)) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message ?? "删除模板失败，请稍后重试。");
      }

      setTemplates((current) => current.filter((item) => item.id !== templateId));
      setFeedback(data.message ?? "工作流模板已删除");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("删除模板失败，请稍后重试。", requestError));
      return false;
    } finally {
      setIsMutating(false);
    }
  }

  async function exportWorkflowTemplate(templateId: string) {
    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/export`);
      if (!response.ok) {
        throw new Error("导出模板失败，请稍后重试。");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${templateId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback("模板 JSON 已导出");
      return true;
    } catch (requestError) {
      setError(parseErrorMessage("导出模板失败，请稍后重试。", requestError));
      return false;
    }
  }

  async function importWorkflowTemplate(template: ProductWorkflowTemplate) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient("/api/workflows/templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template })
      });
      const data = (await readJson(response)) as Partial<WorkflowTemplateMutationResponse> & { message?: string };

      if (!response.ok || !data.template) {
        throw new Error(data.message ?? "导入模板失败，请稍后重试。");
      }

      setTemplates((current) => [data.template as ProductWorkflowTemplate, ...current]);
      setFeedback(data.message ?? "工作流模板已导入");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("导入模板失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  function replaceTemplateInState(template: ProductWorkflowTemplate) {
    setTemplates((current) =>
      current.map((item) => (item.id === template.id ? template : item))
    );
  }

  async function createWorkflowTemplateVersion(
    templateId: string,
    status: ProductWorkflowTemplateVersion["status"],
    summary?: string
  ) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, summary })
      });
      const data = (await readJson(response)) as Partial<WorkflowTemplateVersionMutationResponse> & { message?: string };

      if (!response.ok || !data.template || !data.version) {
        throw new Error(data.message ?? "模板版本保存失败，请稍后重试。");
      }

      replaceTemplateInState(data.template);
      setFeedback(data.message ?? "模板版本已保存");
      return data.version;
    } catch (requestError) {
      setError(parseErrorMessage("模板版本保存失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  async function applyWorkflowTemplateVersion(templateId: string, versionId: string) {
    setIsMutating(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiClient(`/api/workflows/templates/${templateId}/versions/${versionId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = (await readJson(response)) as Partial<WorkflowTemplateVersionMutationResponse> & { message?: string };

      if (!response.ok || !data.template || !data.version) {
        throw new Error(data.message ?? "模板回滚失败，请稍后重试。");
      }

      replaceTemplateInState(data.template);
      setFeedback(data.message ?? "模板已回滚到选定版本");
      return data.template;
    } catch (requestError) {
      setError(parseErrorMessage("模板回滚失败，请稍后重试。", requestError));
      return null;
    } finally {
      setIsMutating(false);
    }
  }

  return {
    advanceWorkflowRun,
    applyApplicationVersion,
    applyWorkflowTemplateVersion,
    applications,
    cancelWorkflowRun,
    createApplicationVersion,
    createWorkflowTemplate,
    createWorkflowTemplateVersion,
    debugApplication,
    deleteWorkflowTemplate,
    duplicateWorkflowTemplate,
    error,
    exportWorkflowTemplate,
    feedback,
    importWorkflowTemplate,
    isLoading,
    isMutating,
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
