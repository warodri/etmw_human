import type { LearningResult } from "../sentence-learning/types.js";
import type { VocabularyCategory } from "../data/vocabulary.js";
import { analyzeInput } from "../sentence-learning/tokenizer.js";
import {
  enumeratePatterns,
  getPatternCap,
  type RuleLearner
} from "../sentence-learning/rule-learner.js";
import { vocabularyIndex, type VocabularyIndex } from "../sentence-learning/category-matcher.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type { RelationshipExtractor } from "./relationship-extractor.js";
import type {
  KnowledgeLearningOptions,
  KnowledgeLearningResult,
  KnowledgeRelationship,
  KnowledgeRelationshipInput
} from "./types.js";

interface RelationshipRecording {
  relationshipsLearned: KnowledgeRelationship[];
  relationshipsSkipped: KnowledgeRelationship[];
  relationshipReason?: string;
  relationshipError?: string;
}

export class KnowledgeLearningService {
  constructor(
    private readonly ruleLearner: Pick<RuleLearner, "learn">,
    private readonly extractor: RelationshipExtractor,
    private readonly repository: KnowledgeRepository,
    private readonly vocabulary: VocabularyIndex = vocabularyIndex,
    private readonly cap: number = getPatternCap()
  ) {}

  async learn(
    input: string,
    options: KnowledgeLearningOptions = {}
  ): Promise<KnowledgeLearningResult> {
    const learning = await this.ruleLearner.learn(input);
    const recording = await this.recordFromLearning(learning, options);

    return {
      ...learning,
      ...recording
    };
  }

  async extractOnly(
    input: string,
    options: KnowledgeLearningOptions = {}
  ): Promise<KnowledgeLearningResult> {
    const parsed = analyzeInput(input, this.vocabulary);
    const { patterns, truncated } = enumeratePatterns(parsed.parts, this.cap);
    const learning: LearningResult = {
      input,
      tokens: parsed.parts,
      learned: [],
      existingRuleIds: [],
      unknownTokens: parsed.unknownTokens,
      truncated
    };
    const recording = await this.recordRelationships(
      input,
      parsed.parts,
      patterns,
      options
    );

    return {
      ...learning,
      ...recording
    };
  }

  private async recordFromLearning(
    learning: LearningResult,
    options: KnowledgeLearningOptions
  ): Promise<RelationshipRecording> {
    const { patterns } = enumeratePatterns(learning.tokens, this.cap);

    return this.recordRelationships(
      learning.input,
      learning.tokens,
      patterns,
      options
    );
  }

  private async recordRelationships(
    input: string,
    tokens: LearningResult["tokens"],
    patterns: VocabularyCategory[][],
    options: KnowledgeLearningOptions
  ): Promise<RelationshipRecording> {
    if (tokens.some((token) => token.possibleCategories.length === 0)) {
      return {
        relationshipsLearned: [],
        relationshipsSkipped: [],
        relationshipReason:
          "Unknown tokens prevent relationship extraction for this sentence."
      };
    }

    try {
      const extraction = this.extractor.extract(tokens, patterns);

      if (extraction.relationships.length === 0) {
        return {
          relationshipsLearned: [],
          relationshipsSkipped: [],
          ...(extraction.reason ? { relationshipReason: extraction.reason } : {})
        };
      }

      const updates: KnowledgeRelationshipInput[] =
        extraction.relationships.map((relationship) => ({
          ...relationship,
          source: "sentence",
          example: input,
          ...(options.observationId
            ? { observationId: options.observationId }
            : {})
        }));
      const summary = await this.repository.upsertRelationships(updates);

      return {
        relationshipsLearned: [...summary.added, ...summary.updated],
        relationshipsSkipped: summary.skipped
      };
    } catch (error) {
      return {
        relationshipsLearned: [],
        relationshipsSkipped: [],
        relationshipError: `Sentence rules were saved, but relationship recording failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      };
    }
  }
}
