import { getUserAiApiKey } from "../aiKeyStore.js";
import type { WorkflowExecutionOptions } from "../services/executor.js";

export async function buildWorkflowExecutionOptions(userId: string): Promise<WorkflowExecutionOptions> {
  const apiKey = await getUserAiApiKey(userId);

  return {
    userId,
    apiKey: apiKey ?? undefined
  };
}
