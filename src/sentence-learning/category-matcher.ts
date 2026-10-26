import { vocabulary, type VocabularyCategory } from "../data/vocabulary.js";
import type { RawToken } from "../services/tokenizer.service.js";
import { normalizeText } from "../utils/normalize.js";
import type {
  CategoryMatch,
  VocabularyArray
} from "./types.js";

export function normalizePhrase(value: string): string {
  return normalizeText(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export class VocabularyIndex {
  private readonly categories: VocabularyCategory[] = Object.keys(
    vocabulary
  ) as VocabularyCategory[];
  private readonly categorySet = new Set<string>(this.categories);
  private readonly entries = new Map<string, VocabularyCategory[]>();
  private readonly members = new Map<VocabularyCategory, Set<string>>();
  private readonly words = new Map<VocabularyCategory, readonly string[]>();
  private readonly longestPhrase: number;

  constructor() {
    let longestPhrase = 1;

    for (const category of this.categories) {
      const categoryWords = vocabulary[category];
      const normalizedWords = new Set<string>();

      this.words.set(category, categoryWords);

      for (const word of categoryWords) {
        const normalized = normalizePhrase(word);
        normalizedWords.add(normalized);

        const existing = this.entries.get(normalized) ?? [];
        if (!existing.includes(category)) {
          existing.push(category);
          this.entries.set(normalized, existing);
        }

        longestPhrase = Math.max(
          longestPhrase,
          normalized.split(" ").length
        );
      }

      this.members.set(category, normalizedWords);
    }

    this.longestPhrase = longestPhrase;
  }

  isCategory(value: string): value is VocabularyCategory {
    return this.categorySet.has(value);
  }

  categoriesFor(text: string): VocabularyCategory[] {
    return [...(this.entries.get(normalizePhrase(text)) ?? [])];
  }

  matchAt(tokens: readonly RawToken[], index: number): CategoryMatch | undefined {
    const first = tokens[index];

    if (!first || first.isPunctuation) {
      return undefined;
    }

    let end = index;

    while (
      end < tokens.length &&
      !tokens[end]!.isPunctuation &&
      end - index < this.longestPhrase
    ) {
      end += 1;
    }

    for (let count = end - index; count >= 1; count -= 1) {
      let phrase = "";

      for (let cursor = index; cursor < index + count; cursor += 1) {
        phrase += `${cursor === index ? "" : " "}${tokens[cursor]!.lower}`;
      }

      const categories = this.entries.get(phrase);

      if (categories) {
        return {
          tokenCount: count,
          categories: [...categories]
        };
      }
    }

    return undefined;
  }

  getWords(category: VocabularyCategory): readonly string[] | undefined {
    return this.words.get(category);
  }

  containsWord(category: VocabularyCategory, word: string): boolean {
    return this.members.get(category)?.has(normalizePhrase(word)) ?? false;
  }

  getArrays(): VocabularyArray[] {
    return this.categories.map((name) => {
      const words = [...(this.words.get(name) ?? [])].sort((left, right) =>
        left.localeCompare(right)
      );

      return {
        name,
        count: words.length,
        words
      };
    });
  }
}

export const vocabularyIndex = new VocabularyIndex();

export function categoriesFor(text: string): VocabularyCategory[] {
  return vocabularyIndex.categoriesFor(text);
}
