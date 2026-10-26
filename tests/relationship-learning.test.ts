import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { JsonKnowledgeRepository } from "../src/word-knowledge/json-knowledge.repository.js";
import { RelationshipLearner } from "../src/word-knowledge/relationship-learner.js";

let directory: string;
let repository: JsonKnowledgeRepository;
let learner: RelationshipLearner;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-relationship-"));
  repository = new JsonKnowledgeRepository(
    path.join(directory, "word-knowledge.json")
  );
  learner = new RelationshipLearner(repository, vocabularyIndex);
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("direct relationship teaching", () => {
  it("adds valid relationships", async () => {
    const result = await learner.teach({
      word: "sky",
      category: "nouns",
      related: [
        { word: "blue", category: "adjectives" },
        { word: "beautiful", category: "adjectives" }
      ]
    });

    expect(result.unknown).toEqual([]);
    expect(result.added).toHaveLength(2);
    expect(result.added.map((entry) => entry.relatedWord)).toEqual([
      "blue",
      "beautiful"
    ]);

    const entries = await repository.getByWord("sky");
    expect(entries[0]?.related.map((entry) => entry.word)).toEqual([
      "blue",
      "beautiful"
    ]);
    expect(entries[0]?.related.every((entry) => entry.sources[0] === "direct")).toBe(
      true
    );
  });

  it("reports an unknown focus word", async () => {
    const result = await learner.teach({
      word: "florp",
      category: "nouns",
      related: [{ word: "blue", category: "adjectives" }]
    });

    expect(result.added).toEqual([]);
    expect(result.unknown).toEqual([
      {
        word: "florp",
        category: "nouns",
        role: "focus",
        reason: '"florp" does not belong to the "nouns" array.'
      }
    ]);
    expect(await repository.getByWord("florp")).toEqual([]);
  });

  it("reports unknown focus categories", async () => {
    const result = await learner.teach({
      word: "sky",
      category: "notARealCategory",
      related: [{ word: "blue", category: "adjectives" }]
    });

    expect(result.added).toEqual([]);
    expect(result.unknown[0]).toMatchObject({
      role: "focus",
      category: "notARealCategory"
    });
  });

  it("reports unknown related words and still adds valid ones", async () => {
    const result = await learner.teach({
      word: "sky",
      category: "nouns",
      related: [
        { word: "blue", category: "adjectives" },
        { word: "florp", category: "adjectives" }
      ]
    });

    expect(result.added).toHaveLength(1);
    expect(result.unknown).toEqual([
      {
        word: "florp",
        category: "adjectives",
        role: "related",
        reason: '"florp" does not belong to the "adjectives" array.'
      }
    ]);
    expect((await repository.getByWord("sky"))[0]?.related).toHaveLength(1);
  });

  it("uses the explicitly provided category for words with multiple memberships", async () => {
    expect(vocabularyIndex.categoriesFor("fast")).toEqual(
      expect.arrayContaining(["adjectives", "adverbs"])
    );

    const result = await learner.teach({
      word: "fast",
      category: "adverbs",
      related: [{ word: "quickly", category: "adverbs" }]
    });

    expect(result.added).toHaveLength(1);
    expect(result.added[0]?.focusCategory).toBe("adverbs");
    expect(result.added[0]?.relatedCategory).toBe("adverbs");
  });

  it("does not reverse a relationship automatically", async () => {
    await learner.teach({
      word: "sky",
      category: "nouns",
      related: [{ word: "blue", category: "adjectives" }]
    });

    expect(await repository.getByWord("blue")).toEqual([]);
  });

  it("skips replayed observations", async () => {
    const input = {
      word: "sky",
      category: "nouns",
      related: [{ word: "blue", category: "adjectives" }],
      observationId: "observation-1"
    };

    await learner.teach(input);
    const replay = await learner.teach(input);
    const entries = await repository.getByWord("sky");

    expect(replay.skipped).toHaveLength(1);
    expect(entries[0]?.related[0]?.occurrences).toBe(1);
  });
});
