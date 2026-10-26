import type { LexiconRepository } from "../repositories/lexicon.repository.js";
import type { TaggingResult, WordCategory } from "../types/tagging.js";
import { Tagger } from "./tagger.service.js";

export class TaggingService {
  private readonly tagger: Tagger;

  constructor(private readonly lexicon: LexiconRepository) {
    this.tagger = new Tagger(lexicon);
  }

  tag(sentence: string): TaggingResult {
    return this.tagger.tag(sentence);
  }

  tagBatch(sentences: string[]): TaggingResult[] {
    return sentences.map((sentence) => this.tag(sentence));
  }

  getCategoryCounts(): Record<string, number> {
    return this.lexicon.getCategoryCounts();
  }

  getVocabularySize(): number {
    return this.lexicon.getAll().length;
  }

  getVocabularyData(): {
    size: number;
    categories: Record<string, number>;
    groups: Array<{ category: WordCategory; count: number; words: string[] }>;
  } {
    const grouped = new Map<WordCategory, Set<string>>();

    for (const entry of this.lexicon.getAll()) {
      for (const category of entry.categories) {
        const words = grouped.get(category) ?? new Set<string>();
        words.add(entry.word);
        grouped.set(category, words);
      }
    }

    const groups = Array.from(grouped.entries())
      .map(([category, words]) => ({
        category,
        count: words.size,
        words: Array.from(words).sort((left, right) => left.localeCompare(right))
      }))
      .sort((left, right) => left.category.localeCompare(right.category));

    return {
      size: this.getVocabularySize(),
      categories: this.getCategoryCounts(),
      groups
    };
  }
}
