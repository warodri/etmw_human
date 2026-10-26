import { vocabularyIndex, type VocabularyIndex } from "../sentence-learning/category-matcher.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type {
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

    if (!this.vocabulary.isCategory(category)) {
      unknown.push({
        word,
        category,
        role: "focus",
        reason: `Unknown vocabulary category "${category}".`
      });
    } else if (!this.vocabulary.containsWord(category, word)) {
      unknown.push({
        word,
        category,
        role: "focus",
        reason: `"${word}" does not belong to the "${category}" array.`
      });
    } else {
      for (const relatedEntry of input.related) {
        const relatedWord = relatedEntry.word.trim();
        const relatedCategory = relatedEntry.category.trim();

        if (!this.vocabulary.isCategory(relatedCategory)) {
          unknown.push({
            word: relatedWord,
            category: relatedCategory,
            role: "related",
            reason: `Unknown vocabulary category "${relatedCategory}".`
          });
          continue;
        }

        if (!this.vocabulary.containsWord(relatedCategory, relatedWord)) {
          unknown.push({
            word: relatedWord,
            category: relatedCategory,
            role: "related",
            reason: `"${relatedWord}" does not belong to the "${relatedCategory}" array.`
          });
          continue;
        }

        updates.push({
          focusWord: word,
          focusCategory: category,
          relatedWord,
          relatedCategory,
          source: "direct",
          ...(input.observationId
            ? { observationId: input.observationId }
            : {})
        });
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
