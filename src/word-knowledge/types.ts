import type { VocabularyCategory } from "../data/vocabulary.js";
import type { LearningResult } from "../sentence-learning/types.js";

export type KnowledgeSource = "direct" | "sentence";
export type KnowledgeAction = "added" | "updated" | "skipped";

export interface RelatedWord {
  word: string;
  category: VocabularyCategory;
  occurrences: number;
  sources: KnowledgeSource[];
  examples: string[];
  observationIds?: string[];
}

export interface WordKnowledge {
  word: string;
  category: VocabularyCategory;
  related: RelatedWord[];
}

export interface KnowledgeRelationshipInput {
  focusWord: string;
  focusCategory: VocabularyCategory;
  relatedWord: string;
  relatedCategory: VocabularyCategory;
  source: KnowledgeSource;
  example?: string;
  observationId?: string;
}

export interface KnowledgeRelationship {
  focusWord: string;
  focusCategory: VocabularyCategory;
  relatedWord: string;
  relatedCategory: VocabularyCategory;
  occurrences: number;
  sources: KnowledgeSource[];
  action: KnowledgeAction;
}

export interface RepositoryUpsertSummary {
  added: KnowledgeRelationship[];
  updated: KnowledgeRelationship[];
  skipped: KnowledgeRelationship[];
}

export interface KnowledgeQueryOptions {
  word?: string;
  category?: VocabularyCategory;
}

export interface UnknownKnowledgeEntry {
  word: string;
  category?: string;
  role: "focus" | "related";
  reason: string;
}

export interface TeachKnowledgeInput {
  word: string;
  category: string;
  related: Array<{ word: string; category: string }>;
  observationId?: string;
}

export interface TeachKnowledgeResult {
  word: string;
  category: string;
  added: KnowledgeRelationship[];
  updated: KnowledgeRelationship[];
  skipped: KnowledgeRelationship[];
  unknown: UnknownKnowledgeEntry[];
}

export interface WordKnowledgeLookup {
  word: string;
  catalogueCategories: VocabularyCategory[];
  entries: WordKnowledge[];
}

export interface ExtractedRelationship {
  focusWord: string;
  focusCategory: VocabularyCategory;
  relatedWord: string;
  relatedCategory: VocabularyCategory;
}

export interface ExtractionResult {
  relationships: ExtractedRelationship[];
  matchedTemplates: number;
  reason?: string;
}

export interface KnowledgeLearningOptions {
  observationId?: string;
}

export interface KnowledgeLearningResult extends LearningResult {
  relationshipsLearned: KnowledgeRelationship[];
  relationshipsSkipped: KnowledgeRelationship[];
  relationshipReason?: string;
  relationshipError?: string;
}

export interface KnowledgeGenerationOptions {
  maxSentences?: number;
  seed?: number;
  ruleId?: string;
}

export interface KnowledgeGenerationSentence {
  sentence: string;
  ruleId: string;
  pattern: VocabularyCategory[];
  words: string[];
  relatedWord: string;
  relatedCategory: VocabularyCategory;
  source: "learned-relationship";
}

export interface KnowledgeGenerationResult {
  focusWord: string;
  sentences: KnowledgeGenerationSentence[];
  reason?: string;
}

export interface KnowledgeSeedDirectGroup {
  word: string;
  category: string;
  related: Array<{ word: string; category: string }>;
  observationId?: string;
}

export interface KnowledgeSeedData {
  sentences: string[];
  directRelationships: KnowledgeSeedDirectGroup[];
}

export interface KnowledgeSeedReport {
  sentencesProcessed: number;
  sentencesLearned: number;
  sentencesSkipped: number;
  rulesAdded: number;
  rulesReused: number;
  distinctPatternsFromSeed: number;
  totalRules: number;
  relationshipsAdded: number;
  relationshipsUpdated: number;
  relationshipsSkipped: number;
  unknown: UnknownKnowledgeEntry[];
  unknownTokens: string[];
  errors: string[];
}
