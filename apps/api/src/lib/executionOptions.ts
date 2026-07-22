import { resolveAiServiceConfig } from "../services/aiServiceConfig.js";
import type { WorkflowExecutionOptions } from "../services/executor.js";

export async function buildWorkflowExecutionOptions(userId: string): Promise<WorkflowExecutionOptions> {
  const config = await resolveAiServiceConfig(userId);

  return {
    userId,
    apiKey: config.apiKey || undefined,
    baseUrl: config.baseUrl
  };
}
