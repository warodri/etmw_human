import {
  adjectives,
  adverbs,
  articles,
  auxiliaryVerbs,
  cardinalNumbers,
  complexPrepositions,
  contractions,
  coordinatingConjunctions,
  correlativeConjunctions,
  degreeAdverbs,
  demonstrativeDeterminers,
  demonstrativePronouns,
  distributives,
  focusingParticles,
  frequencyAdverbs,
  indefinitePronouns,
  infinitiveMarkers,
  interjections,
  interrogativeAdverbs,
  interrogativePronouns,
  linkingAdverbs,
  locativeAdverbs,
  mainVerbs,
  modalVerbs,
  negations,
  nouns,
  objectPronouns,
  ordinals,
  particles,
  personalPronouns,
  possessiveDeterminers,
  possessivePronouns,
  predeterminers,
  prepositions,
  quantifiers,
  reciprocalPronouns,
  reflexivePronouns,
  relativeAdverbs,
  relativePronouns,
  responseWords,
  semiModals,
  subordinatingConjunctions
} from "../data/vocabulary.js";
import type { WordCategory } from "../types/tagging.js";
import { normalizeWord } from "../utils/normalize.js";
import type { LexiconEntry, LexiconRepository } from "./lexicon.repository.js";

const categoryWords: ReadonlyArray<readonly [WordCategory, readonly string[]]> = [
  ["personal pronoun", personalPronouns],
  ["object pronoun", objectPronouns],
  ["possessive determiner", possessiveDeterminers],
  ["possessive pronoun", possessivePronouns],
  ["reflexive pronoun", reflexivePronouns],
  ["reciprocal pronoun", reciprocalPronouns],
  ["indefinite pronoun", indefinitePronouns],
  ["demonstrative pronoun", demonstrativePronouns],
  ["relative pronoun", relativePronouns],
  ["interrogative pronoun", interrogativePronouns],
  ["article", articles],
  ["demonstrative determiner", demonstrativeDeterminers],
  ["quantifier", quantifiers],
  ["distributive", distributives],
  ["auxiliary verb", auxiliaryVerbs],
  ["modal verb", modalVerbs],
  ["semi-modal", semiModals],
  ["coordinating conjunction", coordinatingConjunctions],
  ["subordinating conjunction", subordinatingConjunctions],
  ["correlative conjunction", correlativeConjunctions],
  ["preposition", prepositions],
  ["complex preposition", complexPrepositions],
  ["interrogative adverb", interrogativeAdverbs],
  ["relative adverb", relativeAdverbs],
  ["negation", negations],
  ["particle", particles],
  ["linking adverb", linkingAdverbs],
  ["degree adverb", degreeAdverbs],
  ["frequency adverb", frequencyAdverbs],
  ["interjection", interjections],
  ["response word", responseWords],
  ["ordinal", ordinals],
  ["cardinal number", cardinalNumbers],
  ["contraction", contractions],
  ["locative adverb", locativeAdverbs],
  ["predeterminer", predeterminers],
  ["focusing particle", focusingParticles],
  ["noun", nouns],
  ["main verb", mainVerbs],
  ["adjective", adjectives],
  ["adverb", adverbs],
  ["infinitive marker", infinitiveMarkers]
];

export class InMemoryLexiconRepository implements LexiconRepository {
  private readonly entries = new Map<string, LexiconEntry>();

  constructor() {
    for (const [category, words] of categoryWords) {
      for (const word of words) {
        const normalized = normalizeWord(word);
        const existing = this.entries.get(normalized);

        if (existing) {
          if (!existing.categories.includes(category)) {
            existing.categories.push(category);
          }
          continue;
        }

        this.entries.set(normalized, {
          word: normalized,
          lemma: normalized,
          categories: [category]
        });
      }
    }
  }

  findByWord(word: string): LexiconEntry | undefined {
    return this.entries.get(normalizeWord(word));
  }

  getAll(): readonly LexiconEntry[] {
    return Array.from(this.entries.values());
  }

  getCategoryCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const entry of this.entries.values()) {
      for (const category of entry.categories) {
        counts[category] = (counts[category] ?? 0) + 1;
      }
    }

    return counts;
  }
}
