import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonKnowledgeRepository } from "../src/word-knowledge/json-knowledge.repository.js";
import type { KnowledgeRelationshipInput } from "../src/word-knowledge/types.js";

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "etmw-knowledge-repo-"));
  filePath = path.join(directory, "word-knowledge.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function relation(
  relatedWord: string,
  options: {
    source?: "direct" | "sentence";
    example?: string;
    observationId?: string;
    relatedCategory?: "nouns" | "adjectives";
  } = {}
): KnowledgeRelationshipInput {
  return {
    focusWord: "sky",
    focusCategory: "nouns",
    relatedWord,
    relatedCategory: options.relatedCategory ?? "adjectives",
    source: options.source ?? "direct",
    ...(options.example ? { example: options.example } : {}),
    ...(options.observationId ? { observationId: options.observationId } : {})
  };
}

describe("JsonKnowledgeRepository", () => {
  it("stores a direct relationship and retrieves it case-insensitively", async () => {
    const repository = new JsonKnowledgeRepository(filePath);
    const summary = await repository.upsertRelationships([
      relation("blue")
    ]);

    expect(summary.added).toHaveLength(1);
    expect(summary.added[0]).toMatchObject({
      focusWord: "sky",
      focusCategory: "nouns",
      relatedWord: "blue",
      relatedCategory: "adjectives",
      occurrences: 1,
      sources: ["direct"],
      action: "added"
    });

    const entries = await repository.getByWord("SKY");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.word).toBe("sky");
    expect(entries[0]?.related).toEqual([
      {
        word: "blue",
        category: "adjectives",
        occurrences: 1,
        sources: ["direct"],
        examples: []
      }
    ]);
  });

  it("survives a fresh repository instance", async () => {
    const first = new JsonKnowledgeRepository(filePath);
    await first.upsertRelationships([relation("blue")]);

    const second = new JsonKnowledgeRepository(filePath);
    const entries = await second.getByWord("sky");

    expect(entries[0]?.related[0]?.word).toBe("blue");
  });

  it("merges sources and counts repeated observations", async () => {
    const repository = new JsonKnowledgeRepository(filePath);
    await repository.upsertRelationships([relation("blue")]);
    await repository.upsertRelationships([
      relation("blue", {
        source: "sentence",
        example: "The sky is blue."
      })
    ]);

    const entries = await repository.getByWord("sky");
    const blue = entries[0]?.related[0];

    expect(blue?.occurrences).toBe(2);
    expect(blue?.sources).toEqual(["direct", "sentence"]);
    expect(blue?.examples).toEqual(["The sky is blue."]);
  });

  it("skips a replayed observation id", async () => {
    const repository = new JsonKnowledgeRepository(filePath);
    await repository.upsertRelationships([
      relation("blue", { observationId: "seed:direct:sky" })
    ]);
    const replay = await repository.upsertRelationships([
      relation("blue", { observationId: "seed:direct:sky" })
    ]);

    expect(replay.skipped).toHaveLength(1);
    const entries = await repository.getByWord("sky");
    expect(entries[0]?.related[0]?.occurrences).toBe(1);
  });

  it("caps example history", async () => {
    const repository = new JsonKnowledgeRepository(filePath, 2);
    await repository.upsertRelationships([
      relation("blue", {
        source: "sentence",
        example: "The sky is blue.",
        observationId: "one"
      })
    ]);
    await repository.upsertRelationships([
      relation("blue", {
        source: "sentence",
        example: "The sky is beautiful blue.",
        observationId: "two"
      })
    ]);
    await repository.upsertRelationships([
      relation("blue", {
        source: "sentence",
        example: "A blue sky.",
        observationId: "three"
      })
    ]);

    const entries = await repository.getByWord("sky");
    expect(entries[0]?.related[0]?.examples).toEqual([
      "The sky is beautiful blue.",
      "A blue sky."
    ]);
  });

  it("serialises concurrent writes without losing relationships", async () => {
    const repository = new JsonKnowledgeRepository(filePath);
    await Promise.all([
      repository.upsertRelationships([relation("blue")]),
      repository.upsertRelationships([relation("beautiful")]),
      repository.upsertRelationships([
        {
          focusWord: "dog",
          focusCategory: "nouns",
          relatedWord: "animal",
          relatedCategory: "nouns",
          source: "direct"
        }
      ])
    ]);

    const reloaded = new JsonKnowledgeRepository(filePath);
    const sky = await reloaded.getByWord("sky");
    const dog = await reloaded.getByWord("dog");

    expect(sky[0]?.related.map((entry) => entry.word).sort()).toEqual([
      "beautiful",
      "blue"
    ]);
    expect(dog[0]?.related[0]?.word).toBe("animal");
  });

  it("creates the storage file on first read", async () => {
    const repository = new JsonKnowledgeRepository(filePath);
    expect(await repository.getByWord("sky")).toEqual([]);

    const content = await import("node:fs/promises").then((fs) =>
      fs.readFile(filePath, "utf8")
    );
    expect(content).toBe("[]\n");
  });
});
