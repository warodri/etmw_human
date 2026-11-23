import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

beforeAll(async () => {
  await request(app)
    .post("/api/v1/knowledge/teach")
    .send({
      word: "sky",
      category: "nouns",
      related: [{ word: "blue", category: "adjectives" }]
    })
    .expect(200);

  await request(app)
    .post("/api/v1/knowledge/learn")
    .send({ sentence: "The sky is blue." })
    .expect(200);

  await request(app)
    .post("/api/v1/knowledge/learn")
    .send({ sentence: "The dog is dangerous." })
    .expect(200);

  await request(app)
    .post("/api/v1/knowledge/learn")
    .send({ sentence: "The dog is an animal." })
    .expect(200);

  const directTeachings = [
    {
      word: "building",
      category: "nouns",
      related: [{ word: "beautiful", category: "adjectives" }]
    },
    {
      word: "hotel",
      category: "nouns",
      related: [
        { word: "big", category: "adjectives" },
        { word: "building", category: "nouns" },
        { word: "building", category: "system" }
      ]
    },
    {
      word: "hilton",
      category: "name",
      related: [
        { word: "tall", category: "adjectives" },
        { word: "hotel", category: "system" },
        { word: "paris", category: "name" },
        { word: "building", category: "system" }
      ]
    },
    {
      word: "paris",
      category: "name",
      related: [{ word: "woman", category: "nouns" }]
    }
  ];

  for (const teaching of directTeachings) {
    await request(app)
      .post("/api/v1/knowledge/teach")
      .send(teaching)
      .expect(200);
  }
});

describe("knowledge API", () => {
  it("retrieves stored forward relationships and catalogue categories", async () => {
    const response = await request(app)
      .get("/api/v1/knowledge/sky")
      .expect(200);

    expect(response.body.data.catalogueCategories).toEqual(["nouns"]);
    expect(response.body.data.entries).toHaveLength(1);
    expect(response.body.data.entries[0].category).toBe("nouns");
    expect(response.body.data.entries[0].related).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "blue",
          category: "adjectives",
          sources: ["direct", "sentence"]
        })
      ])
    );
  });

  it("does not expose reverse relationships implicitly", async () => {
    const response = await request(app)
      .get("/api/v1/knowledge/blue")
      .expect(200);

    expect(response.body.data.catalogueCategories).toEqual(["adjectives"]);
    expect(response.body.data.entries).toEqual([]);
  });

  it("reports unknown direct-teaching words without inserting them", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/teach")
      .send({
        word: "florp",
        category: "nouns",
        related: [{ word: "blue", category: "adjectives" }]
      })
      .expect(200);

    expect(response.body.data.added).toEqual([]);
    expect(response.body.data.unknown[0]).toMatchObject({
      word: "florp",
      role: "focus"
    });
  });

  it("generates a sentence about sky from learned knowledge", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "sky", seed: 42, maxSentences: 3 })
      .expect(200);

    expect(response.body.data.focusWord).toBe("sky");
    expect(response.body.data.sentences.length).toBeGreaterThan(0);

    for (const sentence of response.body.data.sentences) {
      expect(sentence.sentence.toLowerCase()).toContain("sky");
      expect(sentence.relatedWord).toBe("blue");
      expect(sentence.relatedCategory).toBe("adjectives");
      expect(sentence.source).toBe("learned-relationship");
      expect(sentence.ruleId).toMatch(/^rule_/);
    }
  });

  it("generates a sentence about dog from stored connections", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "dog", seed: 8, maxSentences: 5 })
      .expect(200);

    expect(response.body.data.sentences.length).toBeGreaterThan(0);

    for (const sentence of response.body.data.sentences) {
      expect(sentence.sentence.toLowerCase()).toContain("dog");
      expect(["dangerous", "animal"]).toContain(sentence.relatedWord);
    }
  });

  it("learns rules and relationships from a new sentence", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/learn")
      .send({ sentence: "The house is big." })
      .expect(200);

    expect(
      response.body.data.learned.length +
        response.body.data.existingRuleIds.length
    ).toBeGreaterThan(0);
    expect(response.body.data.relationshipsLearned).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          focusWord: "house",
          relatedWord: "big"
        })
      ])
    );
  });

  it("learns a rule without inventing an unmatched relationship", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/learn")
      .send({ sentence: "The dog can run quickly." })
      .expect(200);

    expect(
      response.body.data.learned.length +
        response.body.data.existingRuleIds.length
    ).toBeGreaterThan(0);
    expect(response.body.data.relationshipsLearned).toEqual([]);
    expect(response.body.data.relationshipReason).toContain(
      "No configured relationship template"
    );
  });

  it("keeps the existing rule-learning endpoint rule-only", async () => {
    const response = await request(app)
      .post("/api/v1/learning/learn")
      .send({ sentence: "The car is fast." })
      .expect(200);

    expect(response.body.data.learned.length).toBeGreaterThan(0);
    expect(response.body.data.relationshipsLearned).toBeUndefined();
  });

  it("returns an informative empty result when no knowledge exists", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "table" })
      .expect(200);

    expect(response.body.data.sentences).toEqual([]);
    expect(response.body.data.reason).toContain("No stored relationships");
  });

  it("returns an empty result for a missing rule id", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "sky", ruleId: "rule_missing" })
      .expect(200);

    expect(response.body.data.sentences).toEqual([]);
    expect(response.body.data.reason).toContain("was not found");
  });

  it("keeps direct markers in the default lookup response", async () => {
    const response = await request(app)
      .get("/api/v1/knowledge/hilton")
      .expect(200);

    expect(response.body.data.entries[0].category).toBe("name");
    expect(response.body.data.entries[0].related).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ word: "hotel", category: "system" }),
        expect.objectContaining({ word: "paris", category: "name" })
      ])
    );
    expect(response.body.data.effectiveRelationships).toBeUndefined();
    expect(response.body.data.resolutionWarnings).toBeUndefined();
  });

  it("returns resolved inherited relationships with provenance", async () => {
    const response = await request(app)
      .get("/api/v1/knowledge/hilton?includeInherited=true")
      .expect(200);
    const data = response.body.data;

    expect(data.entries[0].category).toBe("name");
    expect(data.resolved).toHaveLength(1);
    expect(data.resolutionWarnings).toEqual([]);
    expect(data.effectiveRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "tall",
          category: "adjectives",
          origin: "direct"
        }),
        expect.objectContaining({
          word: "big",
          category: "adjectives",
          origin: "inherited"
        }),
        expect.objectContaining({
          word: "building",
          category: "nouns",
          origin: "inherited"
        }),
        expect.objectContaining({
          word: "beautiful",
          category: "adjectives",
          origin: "inherited"
        }),
        expect.objectContaining({
          word: "paris",
          category: "name",
          origin: "direct"
        })
      ])
    );
    expect(
      data.effectiveRelationships.some(
        (relationship: { category: string }) =>
          relationship.category === "system"
      )
    ).toBe(false);
    expect(
      data.effectiveRelationships.some(
        (relationship: { word: string }) => relationship.word === "woman"
      )
    ).toBe(false);
  });

  it("rejects system as a top-level teaching category", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/teach")
      .send({
        word: "hotel",
        category: "system",
        related: [{ word: "big", category: "adjectives" }]
      })
      .expect(400);

    expect(response.body.error.message).toContain("Top-level category");
  });

  it("sees newly taught hotel relationships through hilton", async () => {
    await request(app)
      .post("/api/v1/knowledge/teach")
      .send({
        word: "hotel",
        category: "nouns",
        related: [{ word: "expensive", category: "adjectives" }]
      })
      .expect(200);

    const response = await request(app)
      .get("/api/v1/knowledge/hilton?includeInherited=true")
      .expect(200);

    expect(response.body.data.effectiveRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: "expensive",
          category: "adjectives",
          origin: "inherited"
        })
      ])
    );
  });

  it("generates from inherited ordinary relationships", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "hotel", seed: 42, maxSentences: 10 })
      .expect(200);
    const beautiful = response.body.data.sentences.find(
      (sentence: { relatedWord: string }) =>
        sentence.relatedWord === "beautiful"
    );

    expect(beautiful).toMatchObject({
      relatedCategory: "adjectives",
      relatedSlotCategory: "adjectives",
      relatedOrigin: "inherited"
    });
    expect(beautiful.sentence.toLowerCase()).toContain("hotel");
    expect(beautiful.sentence.toLowerCase()).toContain("beautiful");
    expect(
      response.body.data.sentences.some(
        (sentence: { relatedCategory: string }) =>
          sentence.relatedCategory === "system"
      )
    ).toBe(false);
  });

  it("uses a name association when a compatible slot exists", async () => {
    await request(app)
      .post("/api/v1/knowledge/teach")
      .send({
        word: "hotel",
        category: "nouns",
        related: [{ word: "woman", category: "name" }]
      })
      .expect(200);

    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "hotel", seed: 2, maxSentences: 20 })
      .expect(200);
    const woman = response.body.data.sentences.find(
      (sentence: { relatedWord: string }) => sentence.relatedWord === "woman"
    );

    expect(woman).toMatchObject({
      relatedCategory: "name",
      relatedSlotCategory: "nouns",
      relatedOrigin: "direct"
    });
    expect(woman.sentence.toLowerCase()).toContain("woman");
  });

  it("does not fabricate a rule for a name-only focus word", async () => {
    const response = await request(app)
      .post("/api/v1/knowledge/generate")
      .send({ word: "hilton", seed: 1 })
      .expect(200);

    expect(response.body.data.sentences).toEqual([]);
    expect(response.body.data.reason).toContain(
      "no compatible catalogue category"
    );
  });
});
