import type {
  KnowledgeEntryCategory,
  KnowledgeQueryOptions,
  KnowledgeRelationshipInput,
  RepositoryUpsertSummary,
  WordKnowledge
} from "./types.js";

export interface KnowledgeRepository {
  getByWord(word: string): Promise<WordKnowledge[]>;
  getByWordAndCategory(
    word: string,
    category: KnowledgeEntryCategory
  ): Promise<WordKnowledge | undefined>;
  upsertRelationships(
    updates: KnowledgeRelationshipInput[]
  ): Promise<RepositoryUpsertSummary>;
  list(options?: KnowledgeQueryOptions): Promise<WordKnowledge[]>;
  clear(): Promise<void>;
}
