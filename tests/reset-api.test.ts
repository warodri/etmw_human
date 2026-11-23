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
    .post("/api/v1/learning/learn")
    .send({ sentence: "I'm a dog." })
    .expect(200);
});

describe("learning state and reset API", () => {
  it("lists all current knowledge", async () => {
    const response = await request(app)
      .get("/api/v1/knowledge")
      .expect(200);

    expect(response.body.data.count).toBeGreaterThan(0);
    expect(
      response.body.data.entries.some(
        (entry: { word: string }) => entry.word === "sky"
      )
    ).toBe(true);
  });

  it("requires explicit confirmation for reset", async () => {
    await request(app)
      .post("/api/v1/learning/reset")
      .send({ confirm: "yes" })
      .expect(400);

    const rules = await request(app)
      .get("/api/v1/learning/rules")
      .expect(200);

    expect(rules.body.data.count).toBeGreaterThan(0);
  });

  it("clears rules and knowledge and allows learning from zero", async () => {
    const response = await request(app)
      .post("/api/v1/learning/reset")
      .send({ confirm: "RESET" })
      .expect(200);

    expect(response.body.data).toEqual({
      rulesCleared: true,
      knowledgeCleared: true
    });

    const rulesAfter = await request(app)
      .get("/api/v1/learning/rules")
      .expect(200);
    const knowledgeAfter = await request(app)
      .get("/api/v1/knowledge")
      .expect(200);
    const skyAfter = await request(app)
      .get("/api/v1/knowledge/sky")
      .expect(200);

    expect(rulesAfter.body.data.count).toBe(0);
    expect(knowledgeAfter.body.data.count).toBe(0);
    expect(skyAfter.body.data.entries).toEqual([]);

    const learned = await request(app)
      .post("/api/v1/learning/learn")
      .send({ sentence: "I am happy." })
      .expect(200);

    expect(learned.body.data.learned.length).toBeGreaterThan(0);

    const taught = await request(app)
      .post("/api/v1/knowledge/teach")
      .send({
        word: "sky",
        category: "nouns",
        related: [{ word: "blue", category: "adjectives" }]
      })
      .expect(200);

    expect(taught.body.data.added).toHaveLength(1);

    const finalRules = await request(app)
      .get("/api/v1/learning/rules")
      .expect(200);
    const finalKnowledge = await request(app)
      .get("/api/v1/knowledge")
      .expect(200);

    expect(finalRules.body.data.count).toBeGreaterThan(0);
    expect(finalKnowledge.body.data.count).toBe(1);
  });
});
