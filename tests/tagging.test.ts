import { describe, expect, it } from "vitest";
import { InMemoryLexiconRepository } from "../src/repositories/in-memory-lexicon.repository.js";
import { Tagger } from "../src/services/tagger.service.js";
import type { TaggedToken, WordCategory } from "../src/types/tagging.js";
import { formatTagging } from "../src/utils/format.js";

const tagger = new Tagger(new InMemoryLexiconRepository());

function significantTokens(sentence: string): TaggedToken[] {
  return tagger
    .tag(sentence)
    .tokens.filter((token) => token.category !== "punctuation");
}

function pairs(sentence: string): Array<[string, WordCategory]> {
  return significantTokens(sentence).map((token) => [
    token.word,
    token.category
  ]);
}

describe("English part-of-speech tagger", () => {
  it("tags the reference sentence exactly", () => {
    const result = tagger.tag("I am a person");

    expect(formatTagging(result)).toBe(
      [
        "I = personal pronoun",
        "am = auxiliary verb",
        "a = article",
        "person = noun"
      ].join("\n")
    );
  });

  it("tags a possessive determiner and a regular third-person verb", () => {
    expect(pairs("My mom eats cake")).toEqual([
      ["My", "possessive determiner"],
      ["mom", "noun"],
      ["eats", "main verb"],
      ["cake", "noun"]
    ]);
  });

  it("tags a negated imperative", () => {
    expect(pairs("Don't go there")).toEqual([
      ["Don't", "auxiliary verb"],
      ["go", "main verb"],
      ["there", "locative adverb"]
    ]);
  });

  it("tags an inverted question", () => {
    expect(pairs("Are you in trouble")).toEqual([
      ["Are", "auxiliary verb"],
      ["you", "personal pronoun"],
      ["in", "preposition"],
      ["trouble", "noun"]
    ]);
  });

  it("tags a sentence beginning with a linking adverb and a contraction", () => {
    expect(pairs("Definitely it's very cold outside")).toEqual([
      ["Definitely", "linking adverb"],
      ["it's", "personal pronoun"],
      ["very", "degree adverb"],
      ["cold", "adjective"],
      ["outside", "locative adverb"]
    ]);
  });

  it("tags a negated main verb and a demonstrative determiner", () => {
    expect(pairs("I don't trust that person anymore")).toEqual([
      ["I", "personal pronoun"],
      ["don't", "auxiliary verb"],
      ["trust", "main verb"],
      ["that", "demonstrative determiner"],
      ["person", "noun"],
      ["anymore", "adverb"]
    ]);
  });

  it("supports a misspelled unknown noun in a deterministic way", () => {
    expect(pairs("My mon eats cake")).toEqual([
      ["My", "possessive determiner"],
      ["mon", "noun"],
      ["eats", "main verb"],
      ["cake", "noun"]
    ]);
  });

  it("handles auxiliary plus past participle", () => {
    expect(pairs("She has eaten the cake.")).toEqual([
      ["She", "personal pronoun"],
      ["has", "auxiliary verb"],
      ["eaten", "main verb"],
      ["the", "article"],
      ["cake", "noun"]
    ]);
  });

  it("handles a modal question with an object pronoun", () => {
    expect(pairs("Can you help me?")).toEqual([
      ["Can", "modal verb"],
      ["you", "personal pronoun"],
      ["help", "main verb"],
      ["me", "object pronoun"]
    ]);
  });

  it("handles negation and a degree adverb", () => {
    expect(pairs("He is not very tall.")).toEqual([
      ["He", "personal pronoun"],
      ["is", "auxiliary verb"],
      ["not", "negation"],
      ["very", "degree adverb"],
      ["tall", "adjective"]
    ]);
  });

  it("handles a modal, an object pronoun, and a time adverb", () => {
    expect(pairs("They will visit us tomorrow.")).toEqual([
      ["They", "personal pronoun"],
      ["will", "modal verb"],
      ["visit", "main verb"],
      ["us", "object pronoun"],
      ["tomorrow", "adverb"]
    ]);
  });

  it("handles an interjection and a demonstrative pronoun", () => {
    expect(pairs("Wow, that is amazing!")).toEqual([
      ["Wow", "interjection"],
      ["that", "demonstrative pronoun"],
      ["is", "auxiliary verb"],
      ["amazing", "adjective"]
    ]);
  });

  it("handles frequency adverbs and prepositional phrases", () => {
    expect(pairs("I always drink coffee in the morning.")).toEqual([
      ["I", "personal pronoun"],
      ["always", "frequency adverb"],
      ["drink", "main verb"],
      ["coffee", "noun"],
      ["in", "preposition"],
      ["the", "article"],
      ["morning", "noun"]
    ]);
  });

  it("handles an existential construction and a cardinal number", () => {
    expect(pairs("There are three cats in the garden.")).toEqual([
      ["There", "locative adverb"],
      ["are", "auxiliary verb"],
      ["three", "cardinal number"],
      ["cats", "noun"],
      ["in", "preposition"],
      ["the", "article"],
      ["garden", "noun"]
    ]);
  });

  it("handles a negative contraction followed by a main verb", () => {
    expect(pairs("She doesn't like it.")).toEqual([
      ["She", "personal pronoun"],
      ["doesn't", "auxiliary verb"],
      ["like", "main verb"],
      ["it", "personal pronoun"]
    ]);
  });

  it("handles a demonstrative pronoun in subject position", () => {
    expect(pairs("This is my book.")).toEqual([
      ["This", "demonstrative pronoun"],
      ["is", "auxiliary verb"],
      ["my", "possessive determiner"],
      ["book", "noun"]
    ]);
  });

  it("handles a relative clause", () => {
    expect(pairs("The boy who lives here is my brother.")).toEqual([
      ["The", "article"],
      ["boy", "noun"],
      ["who", "relative pronoun"],
      ["lives", "main verb"],
      ["here", "locative adverb"],
      ["is", "auxiliary verb"],
      ["my", "possessive determiner"],
      ["brother", "noun"]
    ]);
  });

  it("distinguishes possessive have from auxiliary have", () => {
    expect(pairs("I have two sisters.")).toEqual([
      ["I", "personal pronoun"],
      ["have", "main verb"],
      ["two", "cardinal number"],
      ["sisters", "noun"]
    ]);

    expect(pairs("I have finished my homework.")).toEqual([
      ["I", "personal pronoun"],
      ["have", "auxiliary verb"],
      ["finished", "main verb"],
      ["my", "possessive determiner"],
      ["homework", "noun"]
    ]);
  });

  it("expands contractions in token metadata without changing the surface form", () => {
    const [token] = significantTokens("Don't go there");

    expect(token).toMatchObject({
      word: "Don't",
      lemma: "do",
      category: "auxiliary verb",
      isContraction: true
    });
    expect(token?.components.map((component) => component.category)).toEqual([
      "auxiliary verb",
      "negation"
    ]);
  });

  it("handles multiple sentences", () => {
    const result = tagger.tag("I am happy. She is tired.");

    expect(result.stats.sentenceCount).toBe(2);
    expect(result.stats.wordCount).toBe(6);
    expect(pairs("I am happy. She is tired.")).toEqual([
      ["I", "personal pronoun"],
      ["am", "auxiliary verb"],
      ["happy", "adjective"],
      ["She", "personal pronoun"],
      ["is", "auxiliary verb"],
      ["tired", "adjective"]
    ]);
  });
});
