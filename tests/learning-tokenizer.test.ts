import { describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { analyzeInput } from "../src/sentence-learning/tokenizer.js";

describe("sentence-learning tokenizer", () => {
  it("keeps contractions together and separates punctuation", () => {
    const parsed = analyzeInput("I'm a dog.", vocabularyIndex);

    expect(parsed.parts.map((part) => part.text)).toEqual(["I'm", "a", "dog"]);
    expect(parsed.parts.map((part) => part.possibleCategories)).toEqual([
      ["contractions"],
      ["articles"],
      ["nouns"]
    ]);
    expect(parsed.separators).toEqual(["", " ", " ", "."]);
    expect(parsed.unknownTokens).toEqual([]);
  });

  it("normalizes curly apostrophes for lookup but preserves source text", () => {
    const parsed = analyzeInput("It’s a dog.", vocabularyIndex);

    expect(parsed.parts[0]?.text).toBe("It’s");
    expect(parsed.parts[0]?.possibleCategories).toContain("contractions");
    expect(parsed.separators[3]).toBe(".");
  });

  it("retains every category for words with multiple memberships", () => {
    const parsed = analyzeInput("that", vocabularyIndex);
    const categories = parsed.parts[0]?.possibleCategories ?? [];

    expect(categories).toEqual(
      expect.arrayContaining([
        "demonstrativePronouns",
        "demonstrativeDeterminers",
        "relativePronouns",
        "subordinatingConjunctions"
      ])
    );
  });

  it("matches the longest multiword expression", () => {
    const parsed = analyzeInput(
      "I am in front of the house.",
      vocabularyIndex
    );
    const phrase = parsed.parts.find((part) => part.text === "in front of");

    expect(phrase?.possibleCategories).toEqual(["complexPrepositions"]);
    expect(parsed.parts.map((part) => part.text)).toEqual([
      "I",
      "am",
      "in front of",
      "the",
      "house"
    ]);
  });

  it("recognises other multiword expressions from the arrays", () => {
    const parsed = analyzeInput(
      "each other and a lot of people",
      vocabularyIndex
    );

    expect(parsed.parts.map((part) => part.text)).toEqual([
      "each other",
      "and",
      "a lot of",
      "people"
    ]);
    expect(parsed.parts[0]?.possibleCategories).toContain(
      "reciprocalPronouns"
    );
    expect(parsed.parts[2]?.possibleCategories).toContain("quantifiers");
  });

  it("returns unknown words without inventing a category", () => {
    const parsed = analyzeInput("I florp a dog.", vocabularyIndex);

    expect(parsed.parts[1]).toMatchObject({
      text: "florp",
      possibleCategories: []
    });
    expect(parsed.unknownTokens).toEqual(["florp"]);
  });

  it("preserves internal punctuation in separators", () => {
    const parsed = analyzeInput("I'm a dog, it's a cat.", vocabularyIndex);

    expect(parsed.separators).toEqual(["", " ", " ", ", ", " ", " ", "."]);
  });

  it("looks up words case-insensitively", () => {
    const parsed = analyzeInput("THE DOG", vocabularyIndex);

    expect(parsed.parts[0]?.possibleCategories).toEqual(["articles"]);
    expect(parsed.parts[1]?.possibleCategories).toEqual(["nouns"]);
  });
});
