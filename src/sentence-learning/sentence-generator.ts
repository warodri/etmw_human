import type { VocabularyCategory } from "../data/vocabulary.js";
import { LearningError } from "./errors.js";
import type {
  GenerationOptions,
  GenerationResult,
  LearnedRule
} from "./types.js";

export interface VocabularyAccessor {
  getWords(category: VocabularyCategory): readonly string[] | undefined;
  containsWord(category: VocabularyCategory, word: string): boolean;
}

export interface PinnedGenerationOptions {
  seed?: number;
  pinned: ReadonlyMap<number, string>;
}

export function createRandom(seed?: number): () => number {
  if (seed === undefined) {
    return Math.random;
  }

  if (!Number.isInteger(seed)) {
    throw new LearningError(
      "The seed must be an integer.",
      "INVALID_SEED",
      400
    );
  }

  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function defaultSeparators(length: number): string[] {
  return Array.from({ length: length + 1 }, (_value, index) => {
    if (index === 0 || index === length) {
      return "";
    }

    return " ";
  });
}

function assemble(
  rule: LearnedRule,
  chosenWords: string[]
): string {
  const separators =
    rule.separators && rule.separators.length === chosenWords.length + 1
      ? rule.separators
      : defaultSeparators(chosenWords.length);

  let sentence = separators[0] ?? "";

  for (let index = 0; index < chosenWords.length; index += 1) {
    sentence += chosenWords[index];
    sentence += separators[index + 1] ?? "";
  }

  return sentence;
}

export class SentenceGenerator {
  constructor(private readonly vocabulary: VocabularyAccessor) {}

  generate(
    rule: LearnedRule,
    options: GenerationOptions = {}
  ): GenerationResult {
    const random = createRandom(options.seed);
    const chosenWords = options.words
      ? this.resolveExplicitWords(rule, options.words)
      : this.resolveRandomWords(rule, random);

    return {
      ruleId: rule.id,
      pattern: [...rule.pattern],
      chosenWords,
      sentence: assemble(rule, chosenWords)
    };
  }

  generateWithPinned(
    rule: LearnedRule,
    options: PinnedGenerationOptions
  ): GenerationResult {
    const random = createRandom(options.seed);
    const chosenWords = rule.pattern.map((category, index) => {
      const pinned = options.pinned.get(index);

      if (pinned !== undefined) {
        const chosen = pinned.trim();

        if (!this.vocabulary.containsWord(category, chosen)) {
          throw new LearningError(
            `"${chosen}" does not belong to the vocabulary array "${category}" at position ${index + 1}.`,
            "WORD_NOT_IN_CATEGORY",
            400
          );
        }

        return chosen;
      }

      return this.resolveRandomWord(category, index, random);
    });

    return {
      ruleId: rule.id,
      pattern: [...rule.pattern],
      chosenWords,
      sentence: assemble(rule, chosenWords)
    };
  }

  private resolveExplicitWords(
    rule: LearnedRule,
    words: string[]
  ): string[] {
    if (words.length !== rule.pattern.length) {
      throw new LearningError(
        `Rule ${rule.id} needs exactly ${rule.pattern.length} words, but ${words.length} were provided.`,
        "WORDS_LENGTH_MISMATCH",
        400
      );
    }

    return words.map((word, index) => {
      const chosen = word.trim();
      const category = rule.pattern[index]!;

      if (chosen.length === 0) {
        throw new LearningError(
          `No word was provided for position ${index + 1} (${category}).`,
          "INVALID_WORDS",
          400
        );
      }

      if (!this.vocabulary.containsWord(category, chosen)) {
        throw new LearningError(
          `"${chosen}" does not belong to the vocabulary array "${category}" at position ${index + 1}.`,
          "WORD_NOT_IN_CATEGORY",
          400
        );
      }

      return chosen;
    });
  }

  private resolveRandomWords(
    rule: LearnedRule,
    random: () => number
  ): string[] {
    return rule.pattern.map((category, index) =>
      this.resolveRandomWord(category, index, random)
    );
  }

  private resolveRandomWord(
    category: VocabularyCategory,
    index: number,
    random: () => number
  ): string {
    const words = this.vocabulary.getWords(category);

    if (!words || words.length === 0) {
      throw new LearningError(
        `The engine has no words in the "${category}" array for position ${index + 1}.`,
        "EMPTY_CATEGORY",
        400
      );
    }

    return words[Math.floor(random() * words.length)]!;
  }
}
