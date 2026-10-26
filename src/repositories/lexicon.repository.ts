import type { WordCategory } from "../types/tagging.js";

export interface LexiconEntry {
  word: string;
  lemma: string;
  categories: WordCategory[];
}

export interface LexiconRepository {
  findByWord(word: string): LexiconEntry | undefined;
  getAll(): readonly LexiconEntry[];
  getCategoryCounts(): Record<string, number>;
}
