import type { VocabularyCategory } from "../data/vocabulary.js";
import { normalizePhrase, vocabularyIndex, type VocabularyIndex } from "../sentence-learning/category-matcher.js";
import { enumeratePatterns, getPatternCap } from "../sentence-learning/rule-learner.js";
import { analyzeInput } from "../sentence-learning/tokenizer.js";
import type { LearnedRule } from "../sentence-learning/types.js";
import type { SentenceGenerator } from "../sentence-learning/sentence-generator.js";
import { KnowledgeError } from "./errors.js";
import type { KnowledgeRepository } from "./knowledge-repository.js";
import type {
  KnowledgeGenerationOptions,
  KnowledgeGenerationResult,
  KnowledgeGenerationSentence
} from "./types.js";

function positionsOf(
  pattern: VocabularyCategory[],
  category: VocabularyCategory
): number[] {
  const positions: number[] = [];

  pattern.forEach((candidate, index) => {
    if (candidate === category) {
      positions.push(index);
    }
  });

  return positions;
}

function exampleContains(
  example: string,
  word: string
): boolean {
  const escaped = normalizePhrase(word).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`,
    "u"
  ).test(normalizePhrase(example));
}

function patternsEqual(
  left: VocabularyCategory[],
  right: VocabularyCategory[]
): boolean {
  return (
    left.length === right.length &&
    left.every((category, index) => category === right[index])
  );
}

function preferredExampleWords(
  rule: LearnedRule,
  focusWord: string,
  relatedWord: string,
  vocabulary: VocabularyIndex,
  cap: number
): string[] | undefined {
  const both = rule.examples.filter(
    (example) =>
      exampleContains(example, focusWord) &&
      exampleContains(example, relatedWord)
  );
  const focusOnly = rule.examples.filter((example) =>
    exampleContains(example, focusWord)
  );
  const candidates = Array.from(
    new Set([...both, ...focusOnly, ...rule.examples])
  );

  for (const example of candidates) {
    const parsed = analyzeInput(example, vocabulary);

    if (parsed.unknownTokens.length > 0) {
      continue;
    }

    const { patterns } = enumeratePatterns(parsed.parts, cap);

    if (!patterns.some((pattern) => patternsEqual(pattern, rule.pattern))) {
      continue;
    }

    return parsed.parts.map((part) => part.text);
  }

  return undefined;
}

function rulePreference(
  rule: LearnedRule,
  focusWord: string,
  relatedWord: string
): number {
  const hasFocus = rule.examples.some((example) =>
    exampleContains(example, focusWord)
  );
  const hasBoth = rule.examples.some(
    (example) =>
      exampleContains(example, focusWord) &&
      exampleContains(example, relatedWord)
  );

  if (hasBoth) {
    return 0;
  }

  return hasFocus ? 1 : 2;
}

export class KnowledgeGenerator {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly rulesProvider: () => Promise<LearnedRule[]>,
    private readonly generator: SentenceGenerator,
    private readonly vocabulary: VocabularyIndex = vocabularyIndex,
    private readonly cap: number = getPatternCap()
  ) {}

  async generate(
    word: string,
    options: KnowledgeGenerationOptions = {}
  ): Promise<KnowledgeGenerationResult> {
    const focusWord = word.trim();
    const maxSentences = options.maxSentences ?? 5;

    if (!Number.isInteger(maxSentences) || maxSentences < 1) {
      throw new KnowledgeError(
        "maxSentences must be a positive integer.",
        "INVALID_KNOWLEDGE_INPUT",
        400
      );
    }

    if (options.seed !== undefined && !Number.isInteger(options.seed)) {
      throw new KnowledgeError(
        "The seed must be an integer.",
        "INVALID_KNOWLEDGE_INPUT",
        400
      );
    }

    if (focusWord.length === 0) {
      throw new KnowledgeError(
        "The focus word must not be empty.",
        "INVALID_KNOWLEDGE_INPUT",
        400
      );
    }

    const knowledgeEntries = await this.repository.getByWord(focusWord);

    if (knowledgeEntries.length === 0) {
      return {
        focusWord,
        sentences: [],
        reason: `No stored relationships were found for "${focusWord}".`
      };
    }

    const withRelationships = knowledgeEntries.filter(
      (entry) => entry.related.length > 0
    );

    if (withRelationships.length === 0) {
      return {
        focusWord,
        sentences: [],
        reason: `No related words are stored for "${focusWord}".`
      };
    }

    const allRules = await this.rulesProvider();
    const rules = options.ruleId
      ? allRules.filter((rule) => rule.id === options.ruleId)
      : allRules;

    if (rules.length === 0) {
      return {
        focusWord,
        sentences: [],
        reason: options.ruleId
          ? `Learned rule "${options.ruleId}" was not found.`
          : "No learned sentence rules are available."
      };
    }

    const sentences: KnowledgeGenerationSentence[] = [];
    const seenSentences = new Set<string>();
    let candidateIndex = 0;
    let lastError: string | undefined;

    for (const knowledge of withRelationships) {
      for (const related of knowledge.related) {
        const orderedRules = [...rules].sort(
          (left, right) =>
            rulePreference(left, focusWord, related.word) -
            rulePreference(right, focusWord, related.word)
        );

        for (const rule of orderedRules) {
          const focusPositions = positionsOf(
            rule.pattern,
            knowledge.category
          );
          const relatedPositions = positionsOf(
            rule.pattern,
            related.category
          );
          const positionPairs: Array<{
            focusPosition: number;
            relatedPosition: number;
          }> = [];

          for (const focusPosition of focusPositions) {
            for (const relatedPosition of relatedPositions) {
              if (focusPosition !== relatedPosition) {
                positionPairs.push({ focusPosition, relatedPosition });
              }
            }
          }

          positionPairs.sort((left, right) => {
            const leftFollows =
              left.relatedPosition > left.focusPosition ? 0 : 1;
            const rightFollows =
              right.relatedPosition > right.focusPosition ? 0 : 1;
            return leftFollows - rightFollows;
          });

          const exampleWords = preferredExampleWords(
            rule,
            focusWord,
            related.word,
            this.vocabulary,
            this.cap
          );

          for (const pair of positionPairs) {
            const candidateSeed =
              options.seed === undefined
                ? undefined
                : options.seed + candidateIndex;
            candidateIndex += 1;
            const pinned = new Map<number, string>([
              [pair.focusPosition, focusWord],
              [pair.relatedPosition, related.word]
            ]);

            if (exampleWords) {
              exampleWords.forEach((word, index) => {
                if (!pinned.has(index)) {
                  pinned.set(index, word);
                }
              });
            }

            try {
              const result = this.generator.generateWithPinned(rule, {
                ...(candidateSeed === undefined ? {} : { seed: candidateSeed }),
                pinned
              });

              if (seenSentences.has(result.sentence)) {
                continue;
              }

              seenSentences.add(result.sentence);
              sentences.push({
                sentence: result.sentence,
                ruleId: rule.id,
                pattern: [...result.pattern],
                words: [...result.chosenWords],
                relatedWord: related.word,
                relatedCategory: related.category,
                source: "learned-relationship"
              });

              if (sentences.length >= maxSentences) {
                return {
                  focusWord,
                  sentences
                };
              }
            } catch (error) {
              lastError =
                error instanceof Error ? error.message : "Generation failed.";
            }
          }
        }
      }
    }

    return {
      focusWord,
      sentences,
      ...(sentences.length === 0
        ? {
            reason:
              lastError ??
              `No learned rule can host "${focusWord}" with one of its stored relationships.`
          }
        : {})
    };
  }
}
