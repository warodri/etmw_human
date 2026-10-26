import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { RuleLearner } from "../src/sentence-learning/rule-learner.js";
import { RuleStore } from "../src/sentence-learning/rule-store.js";

let directory: string;
let rulesPath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-rule-learner-"));
  rulesPath = path.join(directory, "learned-rules.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function makeLearner(cap = 100): { learner: RuleLearner; store: RuleStore } {
  const store = new RuleStore(rulesPath);
  return {
    store,
    learner: new RuleLearner(store, vocabularyIndex, cap)
  };
}

describe("rule learner", () => {
  it("learns the contraction sequence", async () => {
    const { learner } = makeLearner();
    const result = await learner.learn("I'm a dog.");

    expect(result.input).toBe("I'm a dog.");
    expect(result.unknownTokens).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.learned).toHaveLength(1);
    expect(result.learned[0]).toMatchObject({
      id: "rule_001",
      pattern: ["contractions", "articles", "nouns"],
      examples: ["I'm a dog."],
      count: 1,
      separators: ["", " ", " ", "."]
    });
    expect(result.existingRuleIds).toEqual([]);
  });

  it("learns the personal pronoun and auxiliary sequence", async () => {
    const { learner } = makeLearner();
    const result = await learner.learn("I am a dog.");

    expect(result.unknownTokens).toEqual([]);
    expect(result.learned.map((rule) => rule.pattern)).toEqual(
      expect.arrayContaining([
        ["personalPronouns", "auxiliaryVerbs", "articles", "nouns"],
        ["personalPronouns", "mainVerbs", "articles", "nouns"]
      ])
    );
  });

  it("learns adjective sequences", async () => {
    const { learner } = makeLearner();
    const result = await learner.learn("She is happy.");

    expect(result.learned.map((rule) => rule.pattern)).toEqual(
      expect.arrayContaining([
        ["personalPronouns", "auxiliaryVerbs", "adjectives"],
        ["personalPronouns", "mainVerbs", "adjectives"]
      ])
    );
  });

  it("learns a longer adjective sequence", async () => {
    const { learner } = makeLearner();
    const result = await learner.learn("The big dog is happy.");

    expect(result.learned.map((rule) => rule.pattern)).toEqual(
      expect.arrayContaining([
        [
          "articles",
          "adjectives",
          "nouns",
          "auxiliaryVerbs",
          "adjectives"
        ],
        ["articles", "adjectives", "nouns", "mainVerbs", "adjectives"]
      ])
    );
  });

  it("uses the complex preposition as one learned part", async () => {
    const { learner } = makeLearner();
    const result = await learner.learn("I am in front of the house.");

    expect(result.tokens.map((token) => token.text)).toEqual([
      "I",
      "am",
      "in front of",
      "the",
      "house"
    ]);
    expect(
      result.learned.some((rule) =>
        rule.pattern.includes("complexPrepositions")
      )
    ).toBe(true);
  });

  it("updates an existing pattern instead of creating a duplicate", async () => {
    const { learner, store } = makeLearner();
    const first = await learner.learn("I'm a dog.");
    const ruleId = first.learned[0]!.id;
    const second = await learner.learn("It’s a dog.");

    expect(second.learned).toEqual([]);
    expect(second.existingRuleIds).toEqual([ruleId]);

    const rules = await store.getRules();
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: ruleId,
      count: 2,
      examples: ["I'm a dog.", "It’s a dog."]
    });
  });

  it("reports unknown words and does not create a rule", async () => {
    const { learner, store } = makeLearner();
    const result = await learner.learn("I florp a dog.");

    expect(result.unknownTokens).toEqual(["florp"]);
    expect(result.learned).toEqual([]);
    expect(result.existingRuleIds).toEqual([]);
    expect(await store.getRules()).toEqual([]);
  });

  it("matches a new input against a stored pattern", async () => {
    const { learner } = makeLearner();
    const learned = await learner.learn("I'm a dog.");
    const ruleId = learned.learned[0]!.id;
    const match = await learner.match("It's a cat.");

    expect(match.ruleIds).toEqual([ruleId]);
    expect(match.tokens.map((token) => token.text)).toEqual([
      "It's",
      "a",
      "cat"
    ]);
  });

  it("reports the safety cap when ambiguous sequences exceed it", async () => {
    const { learner, store } = makeLearner(1);
    const result = await learner.learn("am");

    expect(result.truncated).toBe(true);
    expect(result.learned).toHaveLength(1);
    expect((await store.getRules())).toHaveLength(1);
  });

  it("persists learned rules for a new store instance", async () => {
    const { learner } = makeLearner();
    const learned = await learner.learn("I'm a dog.");
    const ruleId = learned.learned[0]!.id;
    const reloaded = new RuleStore(rulesPath);
    const rules = await reloaded.getRules();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: ruleId,
      pattern: ["contractions", "articles", "nouns"]
    });
  });
});
