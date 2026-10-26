import type { VocabularyCategory } from "../data/vocabulary.js";

export interface TokenAnalysis {
  text: string;
  possibleCategories: VocabularyCategory[];
  start: number;
  end: number;
}

export interface LearnedRule {
  id: string;
  pattern: VocabularyCategory[];
  examples: string[];
  count: number;
  separators?: string[];
}

export interface LearningResult {
  input: string;
  tokens: TokenAnalysis[];
  learned: LearnedRule[];
  existingRuleIds: string[];
  unknownTokens: string[];
  truncated: boolean;
}

export interface GenerationResult {
  ruleId: string;
  pattern: VocabularyCategory[];
  chosenWords: string[];
  sentence: string;
}

export interface GenerationOptions {
  seed?: number;
  words?: string[];
}

export interface MatchResult {
  ruleIds: string[];
  tokens: TokenAnalysis[];
}

export interface VocabularyArray {
  name: VocabularyCategory;
  count: number;
  words: string[];
}

export interface ParsedSentence {
  parts: TokenAnalysis[];
  separators: string[];
  unknownTokens: string[];
}

export interface CategoryMatch {
  tokenCount: number;
  categories: VocabularyCategory[];
}
