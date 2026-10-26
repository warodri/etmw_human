import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

let ruleId = "";

beforeAll(async () => {
  const response = await request(app)
    .post("/api/v1/learning/learn")
    .send({ sentence: "I'm a dog." })
    .expect(200);

  ruleId = response.body.data.learned[0].id;
});

describe("sentence-learning API", () => {
  it("lists learned rules", async () => {
    const response = await request(app)
      .get("/api/v1/learning/rules")
      .expect(200);

    const rule = response.body.data.rules.find(
      (entry: { id: string }) => entry.id === ruleId
    );

    expect(rule.pattern).toEqual(["contractions", "articles", "nouns"]);
    expect(rule.examples).toContain("I'm a dog.");
  });

  it("matches new text against stored rules", async () => {
    const response = await request(app)
      .post("/api/v1/learning/match")
      .send({ sentence: "It's a cat." })
      .expect(200);

    expect(response.body.data.ruleIds).toContain(ruleId);
  });

  it("generates from explicit words", async () => {
    const response = await request(app)
      .post("/api/v1/learning/generate")
      .send({
        ruleId,
        words: ["It's", "a", "dog"]
      })
      .expect(200);

    expect(response.body.data.sentence).toBe("It's a dog.");
    expect(response.body.data.chosenWords).toEqual(["It's", "a", "dog"]);
  });

  it("rejects an explicit word from the wrong array", async () => {
    const response = await request(app)
      .post("/api/v1/learning/generate")
      .send({
        ruleId,
        words: ["It's", "dog", "dog"]
      })
      .expect(400);

    expect(response.body.error.message).toContain(
      'does not belong to the vocabulary array "articles"'
    );
  });

  it("returns 404 for an unknown rule id", async () => {
    const response = await request(app)
      .post("/api/v1/learning/generate")
      .send({ ruleId: "rule_999" })
      .expect(404);

    expect(response.body.error.message).toContain("was not found");
  });

  it("reports unknown words without learning a rule", async () => {
    const response = await request(app)
      .post("/api/v1/learning/learn")
      .send({ sentence: "I florp a dog." })
      .expect(200);

    expect(response.body.data.unknownTokens).toEqual(["florp"]);
    expect(response.body.data.learned).toEqual([]);
  });

  it("exposes the source vocabulary arrays", async () => {
    const response = await request(app)
      .get("/api/v1/learning/vocabulary")
      .expect(200);

    const contractions = response.body.data.arrays.find(
      (entry: { name: string }) => entry.name === "contractions"
    );

    expect(contractions.words).toContain("I'm");
    expect(contractions.count).toBeGreaterThan(10);
  });

  it("supports seeded random generation", async () => {
    const first = await request(app)
      .post("/api/v1/learning/generate")
      .send({ ruleId, seed: 9 })
      .expect(200);

    const second = await request(app)
      .post("/api/v1/learning/generate")
      .send({ ruleId, seed: 9 })
      .expect(200);

    expect(first.body.data).toEqual(second.body.data);
  });

  it("generates from a randomly selected stored rule", async () => {
    const response = await request(app)
      .post("/api/v1/learning/generate/random")
      .send({ seed: 3 })
      .expect(200);

    expect(response.body.data.ruleId).toMatch(/^rule_\d+$/);
    expect(response.body.data.sentence).toBeTypeOf("string");
  });

  it("learns several sentences in one batch", async () => {
    const response = await request(app)
      .post("/api/v1/learning/learn/batch")
      .send({
        sentences: ["She is happy.", "The big dog is happy."]
      })
      .expect(200);

    expect(response.body.meta.count).toBe(2);
    expect(response.body.data).toHaveLength(2);
  });
});
