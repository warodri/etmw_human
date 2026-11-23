import "dotenv/config";
import { normalizePhrase, vocabularyIndex } from "../sentence-learning/category-matcher.js";
import {
  clearLearnedRules,
  getRules
} from "../sentence-learning/index.js";
import { getPatternCap, RuleLearner } from "../sentence-learning/rule-learner.js";
import { defaultRuleStore } from "../sentence-learning/rule-store.js";
import { SentenceGenerator } from "../sentence-learning/sentence-generator.js";
import { createKnowledgeRepository } from "./knowledge-repository.factory.js";
import { KnowledgeGenerator } from "./knowledge-generator.js";
import { KnowledgeLearningService } from "./knowledge-learning.service.js";
import { KnowledgeResolver } from "./knowledge-resolver.js";
import { RelationshipExtractor } from "./relationship-extractor.js";
import { RelationshipLearner } from "./relationship-learner.js";
import type {
  KnowledgeEntryCategory,
  KnowledgeGenerationOptions,
  KnowledgeGenerationResult,
  KnowledgeLearningOptions,
  KnowledgeLearningResult,
  KnowledgeQueryOptions,
  ResolvedKnowledge,
  ResolvedKnowledgeLookup,
  ResolvedRelationship,
  TeachKnowledgeInput,
  TeachKnowledgeResult,
  WordKnowledge,
  WordKnowledgeLookup
} from "./types.js";

const repository = createKnowledgeRepository();
const relationshipLearner = new RelationshipLearner(repository, vocabularyIndex);
const relationshipExtractor = new RelationshipExtractor();
const ruleLearner = new RuleLearner(defaultRuleStore, vocabularyIndex);
const knowledgeLearning = new KnowledgeLearningService(
  ruleLearner,
  relationshipExtractor,
  repository,
  vocabularyIndex
);
const knowledgeResolver = new KnowledgeResolver(repository);
const knowledgeGenerator = new KnowledgeGenerator(
  repository,
  getRules,
  new SentenceGenerator(vocabularyIndex),
  vocabularyIndex,
  getPatternCap(),
  knowledgeResolver
);

export async function teachKnowledge(
  input: TeachKnowledgeInput
): Promise<TeachKnowledgeResult> {
  return relationshipLearner.teach(input);
}

export async function learnKnowledgeSentence(
  sentence: string,
  options: KnowledgeLearningOptions = {}
): Promise<KnowledgeLearningResult> {
  return knowledgeLearning.learn(sentence, options);
}

export async function learnKnowledgeSentences(
  sentences: string[]
): Promise<KnowledgeLearningResult[]> {
  const results: KnowledgeLearningResult[] = [];

  for (const sentence of sentences) {
    results.push(await knowledgeLearning.learn(sentence));
  }

  return results;
}

function samePath(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((part, index) => part === right[index])
  );
}

function mergeEffective(
  resolved: ResolvedKnowledge[]
): ResolvedRelationship[] {
  const effective = new Map<string, ResolvedRelationship>();

  for (const entry of resolved) {
    for (const relationship of entry.effective) {
      const key = JSON.stringify([
        normalizePhrase(relationship.word),
        relationship.category
      ]);
      const existing = effective.get(key);

      if (!existing) {
        effective.set(key, {
          ...relationship,
          ...(relationship.path ? { path: [...relationship.path] } : {}),
          ...(relationship.alternativePaths
            ? {
                alternativePaths: relationship.alternativePaths.map(
                  (path) => [...path]
                )
              }
            : {})
        });
        continue;
      }

      if (existing.origin === "direct") {
        continue;
      }

      if (relationship.origin === "direct") {
        effective.set(key, {
          ...relationship,
          ...(relationship.path ? { path: [...relationship.path] } : {}),
          ...(relationship.alternativePaths
            ? {
                alternativePaths: relationship.alternativePaths.map(
                  (path) => [...path]
                )
              }
            : {})
        });
        continue;
      }

      if (
        relationship.path &&
        existing.path &&
        !samePath(relationship.path, existing.path)
      ) {
        const alternatives = existing.alternativePaths ?? [];

        if (
          !alternatives.some((path) => samePath(path, relationship.path!))
        ) {
          existing.alternativePaths = [
            ...alternatives,
            [...relationship.path]
          ];
        }
      }
    }
  }

  return Array.from(effective.values());
}

export async function resolveKnowledgeForWord(
  word: string,
  category?: KnowledgeEntryCategory
): Promise<ResolvedKnowledge[]> {
  return knowledgeResolver.resolve(word, category);
}

export async function getKnowledgeForWord(
  word: string,
  options: { includeInherited?: boolean } = {}
): Promise<WordKnowledgeLookup | ResolvedKnowledgeLookup> {
  const lookup: WordKnowledgeLookup = {
    word,
    catalogueCategories: vocabularyIndex.categoriesFor(word),
    entries: await repository.getByWord(word)
  };

  if (!options.includeInherited) {
    return lookup;
  }

  const resolved = await knowledgeResolver.resolve(word);

  return {
    ...lookup,
    resolved,
    effectiveRelationships: mergeEffective(resolved),
    resolutionWarnings: Array.from(
      new Set(resolved.flatMap((entry) => entry.warnings))
    )
  };
}

export async function listKnowledge(
  options: KnowledgeQueryOptions = {}
): Promise<WordKnowledge[]> {
  return repository.list(options);
}

export async function clearKnowledge(): Promise<void> {
  await repository.clear();
}

export async function resetLearning(): Promise<{
  rulesCleared: true;
  knowledgeCleared: true;
}> {
  await clearLearnedRules();
  await repository.clear();

  return {
    rulesCleared: true,
    knowledgeCleared: true
  };
}

export async function generateFromKnowledge(
  word: string,
  options: KnowledgeGenerationOptions = {}
): Promise<KnowledgeGenerationResult> {
  return knowledgeGenerator.generate(word, options);
}

export { KnowledgeError } from "./errors.js";
export { KnowledgeResolver } from "./knowledge-resolver.js";
export type { KnowledgeRepository } from "./knowledge-repository.js";
export type {
  ExtractedRelationship,
  ExtractionResult,
  KnowledgeAction,
  KnowledgeGenerationOptions,
  KnowledgeGenerationResult,
  KnowledgeEntryCategory,
  KnowledgeGenerationSentence,
  KnowledgeLearningOptions,
  KnowledgeLearningResult,
  KnowledgeQueryOptions,
  KnowledgeRelatedCategory,
  KnowledgeRelationship,
  KnowledgeRelationshipInput,
  KnowledgeSeedData,
  KnowledgeSeedReport,
  KnowledgeSource,
  RelatedWord,
  RepositoryUpsertSummary,
  ResolvedKnowledge,
  ResolvedKnowledgeLookup,
  ResolvedRelationship,
  TeachKnowledgeInput,
  TeachKnowledgeResult,
  UnknownKnowledgeEntry,
  WordKnowledge,
  WordKnowledgeLookup
} from "./types.js";
