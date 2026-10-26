import type { VocabularyCategory } from "../data/vocabulary.js";
import { normalizePhrase } from "../sentence-learning/category-matcher.js";
import type { TokenAnalysis } from "../sentence-learning/types.js";
import type {
  ExtractedRelationship,
  ExtractionResult
} from "./types.js";

export interface RelationshipExtractorTemplate {
  pattern: VocabularyCategory[];
  focusIndex: number;
  relatedIndex: number;
}

export const defaultRelationshipExtractorTemplates: readonly RelationshipExtractorTemplate[] = [
  {
    pattern: ["articles", "nouns", "auxiliaryVerbs", "adjectives"],
    focusIndex: 1,
    relatedIndex: 3
  },
  {
    pattern: ["articles", "nouns", "mainVerbs", "adjectives"],
    focusIndex: 1,
    relatedIndex: 3
  },
  {
    pattern: ["articles", "nouns", "auxiliaryVerbs", "articles", "nouns"],
    focusIndex: 1,
    relatedIndex: 4
  },
  {
    pattern: ["articles", "nouns", "mainVerbs", "articles", "nouns"],
    focusIndex: 1,
    relatedIndex: 4
  }
];

function patternsEqual(
  left: VocabularyCategory[],
  right: VocabularyCategory[]
): boolean {
  return (
    left.length === right.length &&
    left.every((category, index) => category === right[index])
  );
}

export class RelationshipExtractor {
  constructor(
    private readonly templates: readonly RelationshipExtractorTemplate[] = defaultRelationshipExtractorTemplates
  ) {}

  extract(
    tokens: TokenAnalysis[],
    patterns: VocabularyCategory[][]
  ): ExtractionResult {
    if (patterns.length === 0) {
      return {
        relationships: [],
        matchedTemplates: 0,
        reason: "No complete category sequence was observed for relationship extraction."
      };
    }

    const relationships: ExtractedRelationship[] = [];
    const seen = new Set<string>();
    let matchedTemplates = 0;

    for (const pattern of patterns) {
      for (const template of this.templates) {
        if (!patternsEqual(pattern, template.pattern)) {
          continue;
        }

        const focusToken = tokens[template.focusIndex];
        const relatedToken = tokens[template.relatedIndex];

        if (!focusToken || !relatedToken) {
          continue;
        }

        matchedTemplates += 1;

        const focusCategory = pattern[template.focusIndex]!;
        const relatedCategory = pattern[template.relatedIndex]!;
        const key = JSON.stringify([
          normalizePhrase(focusToken.text),
          focusCategory,
          normalizePhrase(relatedToken.text),
          relatedCategory
        ]);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        relationships.push({
          focusWord: focusToken.text,
          focusCategory,
          relatedWord: relatedToken.text,
          relatedCategory
        });
      }
    }

    return {
      relationships,
      matchedTemplates,
      ...(relationships.length === 0
        ? {
            reason:
              "No configured relationship template matched the observed category sequence."
          }
        : {})
    };
  }
}
