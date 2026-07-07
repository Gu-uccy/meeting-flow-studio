import type { DbClient } from "../lib/db/client.js";
import type { JsonDocumentRepository } from "./jsonDocumentRepository.js";

export type { JsonDocumentRepository };

export type RepositoryContext = {
  db: DbClient;
};

export type MeetingRepository = JsonDocumentRepository<{ id: string; updatedAt: string }>;
export type WorkflowTemplateRepository = JsonDocumentRepository<{ id: string; updatedAt: string }>;
export type WorkflowRunRepository = JsonDocumentRepository<{ id: string; startedAt: string; endedAt?: string }>;
export type MeetingMemoryRepository = JsonDocumentRepository<{ id: string; updatedAt: string }>;
