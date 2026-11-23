import { vocabularyIndex, type VocabularyIndex } from "../sentence-learning/category-matcher.js";
import { KnowledgeError } from "./errors.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type {
  KnowledgeEntryCategory,
  KnowledgeRelatedCategory,
  KnowledgeRelationshipInput,
  TeachKnowledgeInput,
  TeachKnowledgeResult,
  UnknownKnowledgeEntry
} from "./types.js";

export class RelationshipLearner {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly vocabulary: VocabularyIndex = vocabularyIndex
  ) {}

  async teach(input: TeachKnowledgeInput): Promise<TeachKnowledgeResult> {
    const word = input.word.trim();
    const category = input.category.trim();
    const unknown: UnknownKnowledgeEntry[] = [];
    const updates: KnowledgeRelationshipInput[] = [];

    let acceptedCategory: KnowledgeEntryCategory | undefined;

    if (category === "system") {
      throw new KnowledgeError(
        'Top-level category "system" is a reference marker and cannot be a knowledge entry category.',
        "INVALID_KNOWLEDGE_INPUT",
        400
      );
    }

    if (word.length === 0) {
      unknown.push({
        word,
        category,
        role: "focus",
        reason: "The focus word must not be empty."
      });
    } else if (category === "name") {
      acceptedCategory = "name";
    } else if (this.vocabulary.isCategory(category)) {
      if (this.vocabulary.containsWord(category, word)) {
        acceptedCategory = category;
      } else {
        unknown.push({
          word,
          category,
          role: "focus",
          reason: `"${word}" does not belong to the "${category}" array.`
        });
      }
    } else {
      unknown.push({
        word,
        category,
        role: "focus",
        reason: `Unknown vocabulary category "${category}".`
      });
    }

    if (acceptedCategory) {
      for (const relatedEntry of input.related) {
        const relatedWord = relatedEntry.word.trim();
        const relatedCategory = relatedEntry.category.trim();
        let acceptedRelatedCategory: KnowledgeRelatedCategory | undefined;

        if (relatedWord.length === 0) {
          unknown.push({
            word: relatedWord,
            category: relatedCategory,
            role: "related",
            reason: "The related word must not be empty."
          });
          continue;
        }

        if (
          relatedCategory === "system" ||
          relatedCategory === "name"
        ) {
          acceptedRelatedCategory = relatedCategory;
        } else if (this.vocabulary.isCategory(relatedCategory)) {
          if (this.vocabulary.containsWord(relatedCategory, relatedWord)) {
            acceptedRelatedCategory = relatedCategory;
          } else {
            unknown.push({
              word: relatedWord,
              category: relatedCategory,
              role: "related",
              reason: `"${relatedWord}" does not belong to the "${relatedCategory}" array.`
            });
          }
        } else {
          unknown.push({
            word: relatedWord,
            category: relatedCategory,
            role: "related",
            reason: `Unknown vocabulary category "${relatedCategory}".`
          });
        }

        if (acceptedRelatedCategory) {
          updates.push({
            focusWord: word,
            focusCategory: acceptedCategory,
            relatedWord,
            relatedCategory: acceptedRelatedCategory,
            source: "direct",
            ...(input.observationId
              ? { observationId: input.observationId }
              : {})
          });
        }
      }
    }

    const summary =
      updates.length > 0
        ? await this.repository.upsertRelationships(updates)
        : { added: [], updated: [], skipped: [] };

    return {
      word,
      category,
      added: summary.added,
      updated: summary.updated,
      skipped: summary.skipped,
      unknown
    };
  }
}
