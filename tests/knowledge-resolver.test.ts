import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vocabularyIndex } from "../src/sentence-learning/category-matcher.js";
import { JsonKnowledgeRepository } from "../src/word-knowledge/json-knowledge.repository.js";
import { KnowledgeResolver } from "../src/word-knowledge/knowledge-resolver.js";
import { RelationshipLearner } from "../src/word-knowledge/relationship-learner.js";
import { KnowledgeError } from "../src/word-knowledge/errors.js";

let directory: string;
let repository: JsonKnowledgeRepository;
let learner: RelationshipLearner;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-knowledge-resolver-"));
  repository = new JsonKnowledgeRepository(
    path.join(directory, "word-knowledge.json")
  );
  learner = new RelationshipLearner(repository, vocabularyIndex);
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function teachHiltonFixture(): Promise<void> {
  await learner.teach({
    word: "building",
    category: "nouns",
    related: [{ word: "beautiful", category: "adjectives" }],
    observationId: "building-1"
  });
  await learner.teach({
    word: "hotel",
    category: "nouns",
    related: [
      { word: "big", category: "adjectives" },
      { word: "building", category: "nouns" },
      { word: "building", category: "system" }
    ],
    observationId: "hotel-1"
  });
  await learner.teach({
    word: "hilton",
    category: "name",
    related: [
      { word: "tall", category: "adjectives" },
      { word: "hotel", category: "system" },
      { word: "paris", category: "name" },
      { word: "building", category: "system" }
    ],
    observationId: "hilton-1"
  });
  await learner.teach({
    word: "paris",
    category: "name",
    related: [{ word: "woman", category: "nouns" }],
    observationId: "paris-1"
  });
}

describe("knowledge resolver", () => {
  it("resolves multi-level and multiple reference paths without copying them", async () => {
    await teachHiltonFixture();
    const resolver = new KnowledgeResolver(repository);
    const [hilton] = await resolver.resolve("hilton");

    expect(hilton).toMatchObject({
      word: "hilton",
      category: "name",
      warnings: []
    });
    expect(hilton?.direct.map((entry) => [entry.word, entry.category])).toEqual([
      ["tall", "adjectives"],
      ["hotel", "system"],
      ["paris", "name"],
      ["building", "system"]
    ]);
    expect(hilton?.effective).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "tall",
          category: "adjectives",
          origin: "direct"
        }),
        expect.objectContaining({
          word: "paris",
          category: "name",
          origin: "direct"
        }),
        expect.objectContaining({
          word: "big",
          category: "adjectives",
          origin: "inherited",
          inheritedFrom: "hotel"
        }),
        expect.objectContaining({
          word: "building",
          category: "nouns",
          origin: "inherited",
          inheritedFrom: "hotel"
        }),
        expect.objectContaining({
          word: "beautiful",
          category: "adjectives",
          origin: "inherited"
        })
      ])
    );
    expect(hilton?.effective.some((entry) => entry.category === "system")).toBe(
      false
    );
    expect(hilton?.effective.some((entry) => entry.word === "woman")).toBe(
      false
    );

    const persisted = await repository.getByWord("hilton");
    expect(persisted[0]?.related.map((entry) => entry.word)).toEqual([
      "tall",
      "hotel",
      "paris",
      "building"
    ]);
  });

  it("makes newly taught target relationships visible on the next resolution", async () => {
    await teachHiltonFixture();
    const resolver = new KnowledgeResolver(repository);

    const before = await resolver.resolve("hilton");
    expect(before[0]?.effective.some((entry) => entry.word === "expensive")).toBe(
      false
    );

    await learner.teach({
      word: "hotel",
      category: "nouns",
      related: [{ word: "expensive", category: "adjectives" }],
      observationId: "hotel-expensive"
    });

    const after = await resolver.resolve("hilton");
    expect(after[0]?.effective).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "expensive",
          category: "adjectives",
          origin: "inherited"
        })
      ])
    );
  });

  it("reports missing targets and resolves them when taught later", async () => {
    await learner.teach({
      word: "hilton",
      category: "name",
      related: [
        { word: "missing", category: "system" },
        { word: "tall", category: "adjectives" }
      ]
    });
    const resolver = new KnowledgeResolver(repository);

    const before = await resolver.resolve("hilton");
    expect(before[0]?.warnings.join(" ")).toContain(
      'System reference "missing" from "hilton" could not be resolved'
    );
    expect(await repository.getByWord("missing")).toEqual([]);

    await learner.teach({
      word: "missing",
      category: "name",
      related: [{ word: "woman", category: "nouns" }]
    });

    const after = await resolver.resolve("hilton");
    expect(after[0]?.warnings).toEqual([]);
    expect(after[0]?.effective).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "woman",
          category: "nouns",
          origin: "inherited"
        })
      ])
    );
  });

  it("terminates safely on self-references and two-entry cycles", async () => {
    await learner.teach({
      word: "alpha",
      category: "name",
      related: [{ word: "alpha", category: "system" }]
    });
    await learner.teach({
      word: "beta",
      category: "name",
      related: [{ word: "gamma", category: "system" }]
    });
    await learner.teach({
      word: "gamma",
      category: "name",
      related: [{ word: "beta", category: "system" }]
    });
    const resolver = new KnowledgeResolver(repository);

    const alpha = await resolver.resolve("alpha");
    const beta = await resolver.resolve("beta");

    expect(alpha[0]?.warnings.join(" ")).toContain("cycle detected");
    expect(beta[0]?.warnings.join(" ")).toContain("cycle detected");
  });

  it("deduplicates inherited duplicates with provenance and direct priority", async () => {
    await learner.teach({
      word: "hotel",
      category: "nouns",
      related: [{ word: "big", category: "adjectives" }]
    });
    await learner.teach({
      word: "hilton",
      category: "name",
      related: [
        { word: "big", category: "adjectives" },
        { word: "hotel", category: "system" }
      ]
    });
    const resolver = new KnowledgeResolver(repository);
    const [hilton] = await resolver.resolve("hilton");
    const bigEntries = hilton?.effective.filter(
      (entry) => entry.word === "big" && entry.category === "adjectives"
    );

    expect(bigEntries).toHaveLength(1);
    expect(bigEntries?.[0]?.origin).toBe("direct");
  });

  it("retains multiple inherited paths as one effective relationship", async () => {
    await teachHiltonFixture();
    const resolver = new KnowledgeResolver(repository);
    const [hilton] = await resolver.resolve("hilton");
    const beautifulEntries = hilton?.effective.filter(
      (entry) => entry.word === "beautiful"
    );
    const beautiful = beautifulEntries?.[0];

    expect(beautifulEntries).toHaveLength(1);
    expect(beautiful?.origin).toBe("inherited");
    expect(beautiful?.path).toEqual(["hilton", "hotel", "building"]);
    expect(beautiful?.alternativePaths).toEqual([["hilton", "building"]]);
  });

  it("enforces the configurable maximum traversal depth", async () => {
    await learner.teach({
      word: "a",
      category: "name",
      related: [{ word: "b", category: "system" }]
    });
    await learner.teach({
      word: "b",
      category: "name",
      related: [{ word: "c", category: "system" }]
    });
    await learner.teach({
      word: "c",
      category: "name",
      related: [{ word: "woman", category: "nouns" }]
    });
    const resolver = new KnowledgeResolver(repository, 1);
    const [resolved] = await resolver.resolve("a");

    expect(resolved?.warnings.join(" ")).toContain(
      "Maximum system resolution depth (1)"
    );
  });

  it("rejects system as a top-level category", async () => {
    await expect(
      learner.teach({
        word: "hotel",
        category: "system",
        related: [{ word: "big", category: "adjectives" }]
      })
    ).rejects.toBeInstanceOf(KnowledgeError);
  });

  it("accepts system and name markers without catalogue membership checks", async () => {
    const result = await learner.teach({
      word: "hilton",
      category: "name",
      related: [
        { word: "hotel", category: "system" },
        { word: "paris", category: "name" }
      ]
    });

    expect(result.unknown).toEqual([]);
    expect(result.added).toHaveLength(2);
    expect(result.added.map((entry) => entry.relatedCategory)).toEqual([
      "system",
      "name"
    ]);
  });
});
