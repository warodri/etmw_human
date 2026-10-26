import type { VocabularyCategory } from "../data/vocabulary.js";
import type {
  KnowledgeQueryOptions,
  KnowledgeRelationshipInput,
  RepositoryUpsertSummary,
  WordKnowledge
} from "./types.js";

export interface KnowledgeRepository {
  getByWord(word: string): Promise<WordKnowledge[]>;
  getByWordAndCategory(
    word: string,
    category: VocabularyCategory
  ): Promise<WordKnowledge | undefined>;
  upsertRelationships(
    updates: KnowledgeRelationshipInput[]
  ): Promise<RepositoryUpsertSummary>;
  list(options?: KnowledgeQueryOptions): Promise<WordKnowledge[]>;
}
