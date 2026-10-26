import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { RuleStore } from "../src/sentence-learning/rule-store.js";
import { JsonKnowledgeRepository } from "../src/word-knowledge/json-knowledge.repository.js";
import { KnowledgeSeeder } from "../src/word-knowledge/knowledge-seeder.js";
import type { KnowledgeSeedData } from "../src/word-knowledge/types.js";

const seedPath = fileURLToPath(
  new URL("../src/data/knowledge-seed.json", import.meta.url)
);

let directory: string;
let rulesStore: RuleStore;
let repository: JsonKnowledgeRepository;
let seeder: KnowledgeSeeder;
let seedData: KnowledgeSeedData;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-knowledge-seed-"));
  rulesStore = new RuleStore(path.join(directory, "learned-rules.json"));
  repository = new JsonKnowledgeRepository(
    path.join(directory, "word-knowledge.json")
  );
  seeder = new KnowledgeSeeder(
    rulesStore,
    repository,
    vocabularyIndex,
    100
  );
  seedData = JSON.parse(
    await readFile(seedPath, "utf8")
  ) as KnowledgeSeedData;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("knowledge seeder", () => {
  it("preloads at least 12 distinct rules and the required relationships", async () => {
    const report = await seeder.seed(seedData);

    expect(report.sentencesProcessed).toBeGreaterThanOrEqual(15);
    expect(report.distinctPatternsFromSeed).toBeGreaterThanOrEqual(12);
    expect(report.totalRules).toBeGreaterThanOrEqual(12);
    expect(report.rulesAdded).toBeGreaterThan(0);
    expect(report.relationshipsAdded).toBeGreaterThan(0);
    expect(report.relationshipsUpdated).toBeGreaterThan(0);
    expect(report.unknown).toEqual([]);
    expect(report.unknownTokens).toEqual([]);
    expect(report.errors).toEqual([]);

    const sky = await repository.getByWord("sky");
    const dog = await repository.getByWord("dog");

    expect(sky[0]?.related.map((entry) => entry.word)).toEqual(
      expect.arrayContaining(["blue", "beautiful"])
    );
    expect(dog[0]?.related.map((entry) => entry.word)).toEqual(
      expect.arrayContaining(["animal", "beautiful", "dangerous"])
    );

    const blue = sky[0]?.related.find((entry) => entry.word === "blue");
    expect(blue).toMatchObject({
      occurrences: 2,
      sources: ["direct", "sentence"]
    });
    expect(blue?.examples).toContain("The sky is blue.");

    const rules = await rulesStore.getRules();
    const examples = new Set(rules.flatMap((rule) => rule.examples));
    const requiredSentences = [
      "The sky is blue.",
      "The sky is beautiful.",
      "The dog is dangerous.",
      "The dog is beautiful.",
      "The dog is an animal.",
      "The cat is small.",
      "The house is big.",
      "The car is fast.",
      "The water is cold.",
      "The sun is bright.",
      "The teacher is happy.",
      "The computer is new.",
      "The dog can run quickly.",
      "She will visit us tomorrow.",
      "I am happy."
    ];

    for (const sentence of requiredSentences) {
      expect(examples.has(sentence)).toBe(true);
    }
  });

  it("is idempotent on a second run", async () => {
    const first = await seeder.seed(seedData);
    const skyBefore = await repository.getByWord("sky");
    const blueBefore = skyBefore[0]?.related.find(
      (entry) => entry.word === "blue"
    );
    const second = await seeder.seed(seedData);
    const skyAfter = await repository.getByWord("sky");
    const blueAfter = skyAfter[0]?.related.find(
      (entry) => entry.word === "blue"
    );

    expect(second.rulesAdded).toBe(0);
    expect(second.relationshipsAdded).toBe(0);
    expect(second.relationshipsUpdated).toBe(0);
    expect(second.relationshipsSkipped).toBeGreaterThan(0);
    expect(second.totalRules).toBe(first.totalRules);
    expect(blueAfter?.occurrences).toBe(blueBefore?.occurrences);
    expect(second.unknown).toEqual([]);
    expect(second.errors).toEqual([]);
  });

  it("reports unknown seed tokens without learning a rule", async () => {
    const report = await seeder.seed({
      sentences: ["The florp is blue."],
      directRelationships: []
    });

    expect(report.unknownTokens).toEqual(["florp"]);
    expect(report.sentencesLearned).toBe(0);
    expect(report.rulesAdded).toBe(0);
    expect(report.unknown[0]).toMatchObject({
      word: "florp",
      reason: expect.stringContaining("Unknown token")
    });
  });
});
