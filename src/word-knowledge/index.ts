import "dotenv/config";
import { vocabularyIndex } from "../sentence-learning/category-matcher.js";
import { getRules } from "../sentence-learning/index.js";
import { RuleLearner } from "../sentence-learning/rule-learner.js";
import { defaultRuleStore } from "../sentence-learning/rule-store.js";
import { SentenceGenerator } from "../sentence-learning/sentence-generator.js";
import { createKnowledgeRepository } from "./knowledge-repository.factory.js";
import { KnowledgeGenerator } from "./knowledge-generator.js";
import { KnowledgeLearningService } from "./knowledge-learning.service.js";
import { RelationshipExtractor } from "./relationship-extractor.js";
import { RelationshipLearner } from "./relationship-learner.js";
import type {
  KnowledgeGenerationOptions,
  KnowledgeGenerationResult,
  KnowledgeLearningOptions,
  KnowledgeLearningResult,
  KnowledgeQueryOptions,
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
const knowledgeGenerator = new KnowledgeGenerator(
  repository,
  getRules,
  new SentenceGenerator(vocabularyIndex)
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

export async function getKnowledgeForWord(
  word: string
): Promise<WordKnowledgeLookup> {
  return {
    word,
    catalogueCategories: vocabularyIndex.categoriesFor(word),
    entries: await repository.getByWord(word)
  };
}

export async function listKnowledge(
  options: KnowledgeQueryOptions = {}
): Promise<WordKnowledge[]> {
  return repository.list(options);
}

export async function generateFromKnowledge(
  word: string,
  options: KnowledgeGenerationOptions = {}
): Promise<KnowledgeGenerationResult> {
  return knowledgeGenerator.generate(word, options);
}

export { KnowledgeError } from "./errors.js";
export type { KnowledgeRepository } from "./knowledge-repository.js";
export type {
  ExtractedRelationship,
  ExtractionResult,
  KnowledgeAction,
  KnowledgeGenerationOptions,
  KnowledgeGenerationResult,
  KnowledgeGenerationSentence,
  KnowledgeLearningOptions,
  KnowledgeLearningResult,
  KnowledgeQueryOptions,
  KnowledgeRelationship,
  KnowledgeRelationshipInput,
  KnowledgeSeedData,
  KnowledgeSeedReport,
  KnowledgeSource,
  RelatedWord,
  RepositoryUpsertSummary,
  TeachKnowledgeInput,
  TeachKnowledgeResult,
  UnknownKnowledgeEntry,
  WordKnowledge,
  WordKnowledgeLookup
} from "./types.js";
