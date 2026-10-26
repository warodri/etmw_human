import "dotenv/config";
import { vocabularyIndex } from "./category-matcher.js";
import { LearningError } from "./errors.js";
import { RuleLearner } from "./rule-learner.js";
import { defaultRuleStore } from "./rule-store.js";
import { createRandom, SentenceGenerator } from "./sentence-generator.js";
import type {
  GenerationOptions,
  GenerationResult,
  LearningResult,
  MatchResult,
  VocabularyArray
} from "./types.js";

const learner = new RuleLearner(defaultRuleStore, vocabularyIndex);
const generator = new SentenceGenerator(vocabularyIndex);

export async function learnSentence(input: string): Promise<LearningResult> {
  return learner.learn(input);
}

export async function learnSentences(
  inputs: string[]
): Promise<LearningResult[]> {
  const results: LearningResult[] = [];

  for (const input of inputs) {
    results.push(await learner.learn(input));
  }

  return results;
}

export async function getRules() {
  return defaultRuleStore.getRules();
}

export async function matchSentence(input: string): Promise<MatchResult> {
  return learner.match(input);
}

export async function generateFromRule(
  ruleId: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const rule = await defaultRuleStore.getRule(ruleId);

  if (!rule) {
    throw new LearningError(
      `Learned rule "${ruleId}" was not found.`,
      "RULE_NOT_FOUND",
      404
    );
  }

  return generator.generate(rule, options);
}

export async function generateRandomSentence(
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const rules = await defaultRuleStore.getRules();

  if (rules.length === 0) {
    throw new LearningError(
      "No learned rules are available yet.",
      "NO_RULES",
      404
    );
  }

  const random = createRandom(options.seed);
  const rule = rules[Math.floor(random() * rules.length)]!;

  return generateFromRule(rule.id, options);
}

export function getVocabularyArrays(): VocabularyArray[] {
  return vocabularyIndex.getArrays();
}

export { LearningError } from "./errors.js";
export type {
  GenerationOptions,
  GenerationResult,
  LearnedRule,
  LearningResult,
  MatchResult,
  TokenAnalysis,
  VocabularyArray
} from "./types.js";
export type { VocabularyCategory } from "../data/vocabulary.js";
