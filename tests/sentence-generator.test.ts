import { describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { LearningError } from "../src/sentence-learning/errors.js";
import {
  SentenceGenerator,
  type VocabularyAccessor
} from "../src/sentence-learning/sentence-generator.js";
import type { LearnedRule } from "../src/sentence-learning/types.js";

const rule: LearnedRule = {
  id: "rule_001",
  pattern: ["contractions", "articles", "nouns"],
  examples: ["I'm a dog."],
  count: 1,
  separators: ["", " ", " ", "."]
};

const generator = new SentenceGenerator(vocabularyIndex);

describe("sentence generator", () => {
  it("uses explicit words in the learned order", () => {
    const result = generator.generate(rule, {
      words: ["It's", "a", "dog"]
    });

    expect(result).toEqual({
      ruleId: "rule_001",
      pattern: ["contractions", "articles", "nouns"],
      chosenWords: ["It's", "a", "dog"],
      sentence: "It's a dog."
    });
  });

  it("accepts explicit choices case-insensitively", () => {
    const result = generator.generate(rule, {
      words: ["iT's", "A", "DoG"]
    });

    expect(result.chosenWords).toEqual(["iT's", "A", "DoG"]);
    expect(result.sentence).toBe("iT's A DoG.");
  });

  it("does not reject unusual but array-valid combinations", () => {
    const result = generator.generate(rule, {
      words: ["They're", "a", "dog"]
    });

    expect(result.sentence).toBe("They're a dog.");
  });

  it("rejects words that are not members of the required array", () => {
    expect(() =>
      generator.generate(rule, {
        words: ["It's", "dog", "dog"]
      })
    ).toThrowError(LearningError);

    try {
      generator.generate(rule, {
        words: ["It's", "dog", "dog"]
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "WORD_NOT_IN_CATEGORY"
      });
    }
  });

  it("rejects an explicit word count that does not match the rule", () => {
    expect(() =>
      generator.generate(rule, {
        words: ["It's", "a"]
      })
    ).toThrowError(/needs exactly 3 words/);
  });

  it("produces deterministic results from a seed", () => {
    const first = generator.generate(rule, { seed: 42 });
    const second = generator.generate(rule, { seed: 42 });

    expect(first).toEqual(second);
    expect(first.chosenWords.every((word, index) =>
      vocabularyIndex.containsWord(rule.pattern[index]!, word)
    )).toBe(true);
  });

  it("reports an empty referenced array", () => {
    const accessor: VocabularyAccessor = {
      getWords: (category) => {
        if (category === "nouns") {
          return [];
        }

        if (category === "articles") {
          return ["a"];
        }

        return ["It's"];
      },
      containsWord: () => true
    };
    const emptyGenerator = new SentenceGenerator(accessor);

    expect(() => emptyGenerator.generate(rule)).toThrowError(
      /no words in the "nouns" array/
    );
  });

  it("uses a plain spaced sentence when no separators are stored", () => {
    const plainRule: LearnedRule = {
      id: "rule_002",
      pattern: ["contractions", "articles", "nouns"],
      examples: ["I'm a dog"],
      count: 1
    };

    const result = generator.generate(plainRule, {
      words: ["It's", "a", "dog"]
    });

    expect(result.sentence).toBe("It's a dog");
  });
});
