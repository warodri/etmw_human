export type WordCategory =
  | "personal pronoun"
  | "object pronoun"
  | "possessive determiner"
  | "possessive pronoun"
  | "reflexive pronoun"
  | "reciprocal pronoun"
  | "indefinite pronoun"
  | "demonstrative pronoun"
  | "relative pronoun"
  | "interrogative pronoun"
  | "article"
  | "demonstrative determiner"
  | "quantifier"
  | "distributive"
  | "auxiliary verb"
  | "modal verb"
  | "semi-modal"
  | "coordinating conjunction"
  | "subordinating conjunction"
  | "correlative conjunction"
  | "preposition"
  | "complex preposition"
  | "interrogative adverb"
  | "relative adverb"
  | "negation"
  | "particle"
  | "linking adverb"
  | "degree adverb"
  | "frequency adverb"
  | "interjection"
  | "response word"
  | "ordinal"
  | "cardinal number"
  | "contraction"
  | "locative adverb"
  | "predeterminer"
  | "focusing particle"
  | "noun"
  | "main verb"
  | "adjective"
  | "adverb"
  | "infinitive marker"
  | "punctuation"
  | "unknown";

export interface TaggedComponent {
  word: string;
  lemma: string;
  category: WordCategory;
}

export interface TaggedToken {
  word: string;
  normalized: string;
  lemma: string;
  category: WordCategory;
  confidence: number;
  start: number;
  end: number;
  isContraction: boolean;
  components: TaggedComponent[];
}

export interface TaggingStats {
  tokenCount: number;
  wordCount: number;
  sentenceCount: number;
}

export interface TaggingResult {
  sentence: string;
  tokens: TaggedToken[];
  summary: Record<string, number>;
  stats: TaggingStats;
}
