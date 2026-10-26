import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { RuleLearner } from "../src/sentence-learning/rule-learner.js";
import { RuleStore } from "../src/sentence-learning/rule-store.js";
import { JsonKnowledgeRepository } from "../src/word-knowledge/json-knowledge.repository.js";
import { KnowledgeLearningService } from "../src/word-knowledge/knowledge-learning.service.js";
import type { KnowledgeRepository } from "../src/word-knowledge/knowledge-repository.js";
import { RelationshipExtractor } from "../src/word-knowledge/relationship-extractor.js";
import { RelationshipLearner } from "../src/word-knowledge/relationship-learner.js";
import type {
  RepositoryUpsertSummary,
  WordKnowledge
} from "../src/word-knowledge/types.js";

let directory: string;
let rulesStore: RuleStore;
let knowledgeRepository: JsonKnowledgeRepository;
let learning: KnowledgeLearningService;
let relationshipLearner: RelationshipLearner;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-knowledge-learning-"));
  rulesStore = new RuleStore(path.join(directory, "learned-rules.json"));
  knowledgeRepository = new JsonKnowledgeRepository(
    path.join(directory, "word-knowledge.json")
  );
  learning = new KnowledgeLearningService(
    new RuleLearner(rulesStore, vocabularyIndex, 100),
    new RelationshipExtractor(),
    knowledgeRepository,
    vocabularyIndex,
    100
  );
  relationshipLearner = new RelationshipLearner(
    knowledgeRepository,
    vocabularyIndex
  );
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("sentence learning with relationship extraction", () => {
  it("learns the rule and the sky → blue relationship", async () => {
    const result = await learning.learn("The sky is blue.");

    expect(result.learned.map((rule) => rule.pattern)).toEqual(
      expect.arrayContaining([
        ["articles", "nouns", "auxiliaryVerbs", "adjectives"],
        ["articles", "nouns", "mainVerbs", "adjectives"]
      ])
    );
    expect(result.relationshipsLearned).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          focusWord: "sky",
          focusCategory: "nouns",
          relatedWord: "blue",
          relatedCategory: "adjectives",
          action: "added"
        })
      ])
    );
    expect(result.relationshipReason).toBeUndefined();

    const entries = await knowledgeRepository.getByWord("sky");
    expect(entries[0]?.related[0]).toMatchObject({
      word: "blue",
      category: "adjectives",
      occurrences: 1,
      sources: ["sentence"],
      examples: ["The sky is blue."]
    });
  });

  it("learns noun-to-noun relationships", async () => {
    const result = await learning.learn("The dog is an animal.");

    expect(result.relationshipsLearned).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          focusWord: "dog",
          focusCategory: "nouns",
          relatedWord: "animal",
          relatedCategory: "nouns"
        })
      ])
    );
  });

  it("learns a rule without inventing an unmatched relationship", async () => {
    const result = await learning.learn("The dog can run quickly.");

    expect(result.learned.length).toBeGreaterThan(0);
    expect(result.relationshipsLearned).toEqual([]);
    expect(result.relationshipReason).toContain(
      "No configured relationship template"
    );
    expect(await knowledgeRepository.list()).toEqual([]);
  });

  it("reports unknown tokens and learns nothing", async () => {
    const result = await learning.learn("I florp a dog.");

    expect(result.learned).toEqual([]);
    expect(result.unknownTokens).toEqual(["florp"]);
    expect(result.relationshipsLearned).toEqual([]);
    expect(result.relationshipReason).toContain("Unknown tokens");
  });

  it("skips replayed sentence observations by observation id", async () => {
    const input = "The sky is blue.";
    const first = await learning.extractOnly(input, {
      observationId: "seed:sentence:the-sky-is-blue"
    });
    const second = await learning.extractOnly(input, {
      observationId: "seed:sentence:the-sky-is-blue"
    });

    expect(first.relationshipsLearned).toHaveLength(1);
    expect(second.relationshipsLearned).toEqual([]);
    expect(second.relationshipsSkipped).toHaveLength(1);

    const entries = await knowledgeRepository.getByWord("sky");
    expect(entries[0]?.related[0]?.occurrences).toBe(1);
  });

  it("merges direct and sentence sources", async () => {
    await relationshipLearner.teach({
      word: "sky",
      category: "nouns",
      related: [{ word: "blue", category: "adjectives" }]
    });
    await learning.learn("The sky is blue.");

    const entries = await knowledgeRepository.getByWord("sky");
    expect(entries[0]?.related[0]).toMatchObject({
      occurrences: 2,
      sources: ["direct", "sentence"]
    });
  });

  it("reports a partial outcome when relationship storage fails", async () => {
    const failingRepository: KnowledgeRepository = {
      async getByWord() {
        return [];
      },
      async getByWordAndCategory() {
        return undefined;
      },
      async list(): Promise<WordKnowledge[]> {
        return [];
      },
      async upsertRelationships(): Promise<RepositoryUpsertSummary> {
        throw new Error("storage unavailable");
      }
    };
    const partial = new KnowledgeLearningService(
      new RuleLearner(rulesStore, vocabularyIndex, 100),
      new RelationshipExtractor(),
      failingRepository,
      vocabularyIndex,
      100
    );

    const result = await partial.learn("The sky is blue.");

    expect(result.learned.length).toBeGreaterThan(0);
    expect(result.relationshipsLearned).toEqual([]);
    expect(result.relationshipError).toContain(
      "relationship recording failed"
    );
    expect(result.relationshipError).toContain("storage unavailable");
  });
});
