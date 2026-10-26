import type { VocabularyCategory } from "../data/vocabulary.js";
import { analyzeInput } from "./tokenizer.js";
import { vocabularyIndex, type VocabularyIndex } from "./category-matcher.js";
import type { RuleStore } from "./rule-store.js";
import type {
  LearningResult,
  MatchResult,
  ParsedSentence,
  TokenAnalysis
} from "./types.js";

export function getPatternCap(): number {
  const configured = Number(process.env.LEARNING_PATTERN_CAP ?? 100);

  if (!Number.isInteger(configured) || configured < 1) {
    return 100;
  }

  return configured;
}

function uniqueCategories(
  categories: VocabularyCategory[]
): VocabularyCategory[] {
  return Array.from(new Set(categories));
}

export function enumeratePatterns(
  parts: TokenAnalysis[],
  cap: number
): { patterns: VocabularyCategory[][]; truncated: boolean } {
  if (parts.length === 0) {
    return { patterns: [], truncated: false };
  }

  if (parts.some((part) => part.possibleCategories.length === 0)) {
    return { patterns: [], truncated: false };
  }

  const patterns: VocabularyCategory[][] = [];
  const seen = new Set<string>();
  let stopped = false;
  const current: VocabularyCategory[] = [];

  const walk = (position: number): void => {
    if (stopped) {
      return;
    }

    if (position === parts.length) {
      const key = JSON.stringify(current);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      patterns.push([...current]);

      if (patterns.length > cap) {
        stopped = true;
      }

      return;
    }

    const categories = uniqueCategories(parts[position]!.possibleCategories);

    for (const category of categories) {
      current.push(category);
      walk(position + 1);
      current.pop();

      if (stopped) {
        return;
      }
    }
  };

  walk(0);

  const truncated = patterns.length > cap;

  return {
    patterns: truncated ? patterns.slice(0, cap) : patterns,
    truncated
  };
}

export class RuleLearner {
  constructor(
    private readonly store: RuleStore,
    private readonly index: VocabularyIndex = vocabularyIndex,
    private readonly cap: number = getPatternCap()
  ) {}

  async learn(input: string): Promise<LearningResult> {
    const parsed: ParsedSentence = analyzeInput(input, this.index);
    const { patterns, truncated } = enumeratePatterns(parsed.parts, this.cap);
    const { created, existing } = await this.store.upsertPatterns(
      patterns,
      input,
      parsed.separators
    );

    return {
      input,
      tokens: parsed.parts,
      learned: created,
      existingRuleIds: existing.map((rule) => rule.id),
      unknownTokens: parsed.unknownTokens,
      truncated
    };
  }

  async match(input: string): Promise<MatchResult> {
    const parsed = analyzeInput(input, this.index);
    const { patterns } = enumeratePatterns(parsed.parts, this.cap);
    const rules = await this.store.getRules();
    const idsByPattern = new Map(
      rules.map((rule) => [JSON.stringify(rule.pattern), rule.id])
    );
    const ruleIds: string[] = [];

    for (const pattern of patterns) {
      const id = idsByPattern.get(JSON.stringify(pattern));

      if (id && !ruleIds.includes(id)) {
        ruleIds.push(id);
      }
    }

    return {
      ruleIds,
      tokens: parsed.parts
    };
  }
}
